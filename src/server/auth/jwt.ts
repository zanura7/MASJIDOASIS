/**
 * Minimal HS256 JWT signer/verifier — MAS-22.
 *
 * Used for the short-lived access tokens issued by `POST /auth/verify-otp`.
 *
 * Why hand-rolled (not `jsonwebtoken`):
 *   - The dependency would be the only crypto-related package in the tree.
 *   - HS256 is ~40 lines of Node `crypto` and the alternative ships with
 *     surface area (none/algorithm-confusion CVEs) we don't need.
 *
 * Scope:
 *   - HS256 only. RS256 / ES256 explicitly unsupported.
 *   - Validates `alg`, `exp`, optional `iss`, `aud`.
 *   - `iat` and `nbf` rejected when in the future (with a 30s skew).
 *
 * NOT a general-purpose JWT library. If we ever need asymmetric tokens
 * (e.g. for external API consumers), swap to `jose` for that surface and
 * keep this for the internal access-token path.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const ALG = "HS256";
const CLOCK_SKEW_SEC = 30;

export interface JwtPayload {
  /** Subject — user id. */
  sub: string;
  /** Issued-at (seconds). Set automatically by `signJwt` if omitted. */
  iat?: number;
  /** Expiry (seconds). Required. */
  exp: number;
  /** Not-before (seconds). Optional. */
  nbf?: number;
  /** Issuer (optional, but recommended). */
  iss?: string;
  /** Audience (optional). */
  aud?: string;
  /** Caller-defined extra claims — e.g. role, phone. */
  [k: string]: unknown;
}

export interface SignOptions {
  secret: string;
  /** Expiry in seconds from now. */
  expiresInSec: number;
  /** Issuer claim. Default: "masjidoasis". */
  issuer?: string;
  /** Audience claim. */
  audience?: string;
}

export class JwtError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[jwt:${code}] ${message}`);
    this.name = "JwtError";
    this.code = code;
  }
}

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(input: string, secret: string): string {
  return b64urlEncode(createHmac("sha256", secret).update(input).digest());
}

/** Sign a JWT. Always sets `iat` to now (UTC seconds) and computes `exp`. */
export function signJwt(claims: Omit<JwtPayload, "exp" | "iat"> & { sub: string }, opts: SignOptions): string {
  if (!opts.secret || opts.secret.length < 16) {
    throw new JwtError("config", "secret must be at least 16 characters");
  }
  if (!Number.isFinite(opts.expiresInSec) || opts.expiresInSec <= 0) {
    throw new JwtError("config", "expiresInSec must be positive");
  }
  const now = Math.floor(Date.now() / 1000);
  const iss = (claims.iss as string | undefined) ?? opts.issuer ?? "masjidoasis";
  const payload: JwtPayload = {
    ...claims,
    iss,
    iat: now,
    exp: now + opts.expiresInSec,
  };
  if (opts.audience !== undefined && payload.aud === undefined) {
    payload.aud = opts.audience;
  }
  const header = b64urlEncode(JSON.stringify({ alg: ALG, typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify(payload));
  const signing = `${header}.${body}`;
  const sig = sign(signing, opts.secret);
  return `${signing}.${sig}`;
}

export interface VerifyOptions {
  secret: string;
  /** Required issuer; if set, token's `iss` must match. */
  issuer?: string;
  /** Required audience; if set, token's `aud` must match. */
  audience?: string;
  /** Override "now" for tests (seconds since epoch). */
  now?: number;
}

/** Verify and decode a JWT. Throws JwtError on any failure. */
export function verifyJwt(token: string, opts: VerifyOptions): JwtPayload {
  if (typeof token !== "string" || token.trim() === "") {
    throw new JwtError("malformed", "token is empty");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtError("malformed", "expected 3 segments");
  }
  const [h, p, s] = parts as [string, string, string];

  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(b64urlDecode(h).toString("utf8"));
  } catch {
    throw new JwtError("malformed", "header is not valid JSON");
  }
  if (header.alg !== ALG) {
    throw new JwtError("alg", `unsupported alg: ${String(header.alg)}`);
  }

  // Recompute signature and compare in constant time.
  const expected = sign(`${h}.${p}`, opts.secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(s, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new JwtError("signature", "invalid signature");
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(b64urlDecode(p).toString("utf8")) as JwtPayload;
  } catch {
    throw new JwtError("malformed", "payload is not valid JSON");
  }

  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now - CLOCK_SKEW_SEC) {
    throw new JwtError("expired", "token has expired");
  }
  if (typeof payload.nbf === "number" && payload.nbf > now + CLOCK_SKEW_SEC) {
    throw new JwtError("nbf", "token is not yet valid");
  }
  if (typeof payload.iat === "number" && payload.iat > now + CLOCK_SKEW_SEC) {
    throw new JwtError("iat", "token issued in the future");
  }
  if (opts.issuer !== undefined && payload.iss !== opts.issuer) {
    throw new JwtError("iss", `issuer mismatch: ${String(payload.iss)}`);
  }
  if (opts.audience !== undefined && payload.aud !== opts.audience) {
    throw new JwtError("aud", `audience mismatch: ${String(payload.aud)}`);
  }
  return payload;
}
