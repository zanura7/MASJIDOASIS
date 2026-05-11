/**
 * OTP service — MAS-22.
 *
 * Owns OTP code generation, hashed storage, expiry, attempt tracking, and
 * verification. The OTP *delivery* (sending the SMS/WhatsApp) lives in
 * `src/server/otp` (MAS-21); this module composes it.
 *
 * Storage model (Prisma `OtpCode` from MAS-16):
 *   - One row per (phone, purpose, code) issuance.
 *   - `codeHash` = SHA-256(`${phone}:${code}:${pepper}`) — pepper is the
 *     server JWT_SECRET, so a leaked DB alone can't be replayed without
 *     also leaking the secret.
 *   - `expiresAt` = issued + 5 minutes (per spec).
 *   - `attempts` counter incremented on each failed verify; locked at 5.
 *   - `consumedAt` set on the row that successfully verifies — single use.
 *
 * Policy:
 *   - Only one *active* (unconsumed, unexpired) OTP per (phone, purpose):
 *     re-issuing within the window invalidates prior codes by deleting them.
 *   - TTL: 5 minutes (spec).
 *   - Max attempts: 5 (spec). On the 6th try the row is hard-locked even
 *     if the code is right, and the user must request a new one.
 *
 * Side-effects:
 *   - DB writes (OtpCode rows).
 *   - Calls the OTP provider's `send()` — outbound HTTP. The endpoint
 *     layer is responsible for awaiting this so failures surface to the
 *     client (no silent enqueue).
 */

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

import { prisma } from "@/server/db";
import { assertPhone, toIndonesianMsisdn } from "@/server/otp/types";
import { renderOtpMessage, type OtpProvider } from "@/server/otp";

export const OTP_TTL_SEC = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_CODE_LENGTH = 6;

export type OtpPurpose = "login" | "reset" | "verify";

export class OtpRequestError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "OtpRequestError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class OtpVerifyError extends Error {
  readonly code:
    | "INVALID_CODE"
    | "EXPIRED"
    | "NOT_FOUND"
    | "MAX_ATTEMPTS"
    | "ALREADY_USED"
    | "MALFORMED";
  readonly httpStatus: number;
  constructor(code: OtpVerifyError["code"], httpStatus: number, message: string) {
    super(message);
    this.name = "OtpVerifyError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * Hash an OTP for storage. Peppered with the server secret so a DB-only
 * leak can't be brute-forced (10^6 keyspace + unknown pepper).
 *
 * Stable across processes — pure SHA-256, no per-row salt; we don't need
 * one because rows are unique per (phone, code, pepper) and short-lived.
 */
export function hashOtpCode(phone: string, code: string, pepper: string): string {
  return createHash("sha256").update(`${phone}:${code}:${pepper}`).digest("hex");
}

/**
 * Generate a uniform-random `OTP_CODE_LENGTH`-digit numeric OTP. Uses
 * `crypto.randomInt` — cryptographically secure, no Math.random leakage.
 *
 * Zero-padded; e.g. "042918".
 */
export function generateOtpCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_CODE_LENGTH, "0");
}

/**
 * Normalise a user-supplied phone for storage/lookup. Centralised so the
 * request-otp and verify-otp paths key on identical strings.
 */
export function normalisePhone(phone: string): string {
  assertPhone(phone);
  // Store the digits-only Indonesian MSISDN ("628…"). Lossless for both
  // "+628…" and "08…" inputs and avoids "+/no-+" key drift.
  return toIndonesianMsisdn(phone);
}

export interface RequestOtpInput {
  phone: string;
  purpose?: OtpPurpose;
}

export interface RequestOtpResult {
  /** ms until the issued code expires. */
  expiresInSec: number;
  /** Provider channel used (whatsapp/sms). */
  channel: string;
  /** Provider key actually used. */
  provider: string;
  /** Optional provider message id for audit. */
  providerMessageId?: string;
}

export interface OtpServiceDeps {
  prisma?: typeof prisma;
  provider: OtpProvider;
  /** Server-side pepper for hashing. Typically JWT_SECRET. */
  pepper: string;
  /** Override now() for tests. */
  now?: () => Date;
}

export class OtpService {
  private readonly db: typeof prisma;
  private readonly provider: OtpProvider;
  private readonly pepper: string;
  private readonly now: () => Date;

  constructor(deps: OtpServiceDeps) {
    if (!deps.pepper || deps.pepper.length < 16) {
      throw new Error("OtpService: pepper must be at least 16 characters");
    }
    this.db = deps.prisma ?? prisma;
    this.provider = deps.provider;
    this.pepper = deps.pepper;
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Issue a new OTP for `phone`. Invalidates any prior unconsumed code
   * for the same (phone, purpose) so only the latest is valid.
   */
  async request(input: RequestOtpInput): Promise<RequestOtpResult> {
    const purpose: OtpPurpose = input.purpose ?? "login";
    let phone: string;
    try {
      phone = normalisePhone(input.phone);
    } catch (err) {
      throw new OtpRequestError("INVALID_PHONE", 400, (err as Error).message);
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(phone, code, this.pepper);
    const issuedAt = this.now();
    const expiresAt = new Date(issuedAt.getTime() + OTP_TTL_SEC * 1000);

    // Invalidate prior unconsumed codes for this phone+purpose. We
    // delete rather than soft-expire so the active set is always <= 1
    // and `verify` can pick the freshest row deterministically.
    await this.db.otpCode.deleteMany({
      where: { phone, purpose, consumedAt: null },
    });

    await this.db.otpCode.create({
      data: {
        phone,
        purpose,
        codeHash,
        expiresAt,
        attempts: 0,
      },
    });

    // Deliver via provider AFTER persisting so a transient API failure
    // doesn't leave the user unable to retry (the new row replaces any
    // stale one). If `send` throws, the row stays — that's fine, the
    // next request() call will replace it.
    const send = await this.provider.send({
      phone,
      code,
      message: renderOtpMessage(code),
    });

    return {
      expiresInSec: OTP_TTL_SEC,
      channel: send.channel,
      provider: send.provider,
      ...(send.providerMessageId ? { providerMessageId: send.providerMessageId } : {}),
    };
  }

  /**
   * Verify a (phone, code) pair. On success the matching row is marked
   * consumed and the user record is upserted (creating a new MEMBER if
   * the phone is unknown). Returns the resolved user id so the route
   * handler can mint a JWT.
   */
  async verify(input: { phone: string; code: string; purpose?: OtpPurpose }): Promise<{ userId: string; phone: string }> {
    const purpose: OtpPurpose = input.purpose ?? "login";
    let phone: string;
    try {
      phone = normalisePhone(input.phone);
    } catch (err) {
      throw new OtpVerifyError("MALFORMED", 400, (err as Error).message);
    }
    if (typeof input.code !== "string" || !/^\d{4,8}$/.test(input.code)) {
      throw new OtpVerifyError("MALFORMED", 400, "code must be 4–8 digits");
    }

    const row = await this.db.otpCode.findFirst({
      where: { phone, purpose, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!row) {
      throw new OtpVerifyError("NOT_FOUND", 404, "no active OTP for this phone");
    }

    const now = this.now();
    if (row.expiresAt.getTime() <= now.getTime()) {
      throw new OtpVerifyError("EXPIRED", 410, "OTP has expired; request a new code");
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      throw new OtpVerifyError("MAX_ATTEMPTS", 429, "too many attempts; request a new code");
    }

    const candidate = hashOtpCode(phone, input.code, this.pepper);
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(row.codeHash, "hex");
    const match = a.length === b.length && timingSafeEqual(a, b);

    if (!match) {
      // Bump attempts; if we hit the cap, the next call will surface
      // MAX_ATTEMPTS even if the code is right.
      await this.db.otpCode.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 } },
      });
      throw new OtpVerifyError("INVALID_CODE", 401, "invalid code");
    }

    // Mark consumed and upsert the user atomically so a race between two
    // verify calls doesn't double-mint sessions later. Prisma doesn't
    // give us a true tx context for the upsert here, but the unique
    // constraint on `User.phone` is the real serialiser.
    await this.db.otpCode.update({
      where: { id: row.id },
      data: { consumedAt: now },
    });

    const user = await this.db.user.upsert({
      where: { phone },
      update: { phoneVerifiedAt: now },
      create: {
        phone,
        name: `User ${phone.slice(-4)}`,
        phoneVerifiedAt: now,
      },
      select: { id: true, phone: true },
    });

    return { userId: user.id, phone: user.phone };
  }
}
