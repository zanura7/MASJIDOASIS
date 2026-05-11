/**
 * POST /api/auth/verify-otp — MAS-22.
 *
 * Body: { "phone": "+62…" | "08…", "code": "123456", "purpose"?: "login" | "reset" | "verify" }
 *
 * Responses:
 *   200 → { ok: true, token, user: { id, phone } }
 *   400 → { ok: false, code: "BAD_BODY" | "MALFORMED", message }
 *   401 → { ok: false, code: "INVALID_CODE", message }
 *   404 → { ok: false, code: "NOT_FOUND", message }
 *   410 → { ok: false, code: "EXPIRED", message }
 *   429 → { ok: false, code: "RATE_LIMITED" | "MAX_ATTEMPTS", message }
 *
 * On success the response includes a signed JWT (HS256, 7-day expiry by
 * default) keyed on `JWT_SECRET`. The token's `sub` is the user id. The
 * route also upserts a user row keyed on the verified phone.
 *
 * Rate limit: 10 verify attempts per 5 min per phone (in addition to the
 * per-OTP 5-attempt cap enforced in the service layer).
 */

import { NextRequest, NextResponse } from "next/server";

import { getOtpService } from "@/server/auth/otp-service-singleton";
import { OtpVerifyError, type OtpPurpose } from "@/server/auth/otp-service";
import { verifyOtpPhoneLimiter } from "@/server/auth/rate-limit";
import { signJwt } from "@/server/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_SEC = 7 * 24 * 60 * 60;

interface Body {
  phone?: unknown;
  code?: unknown;
  purpose?: unknown;
}

function parsePurpose(v: unknown): OtpPurpose {
  if (v === "reset" || v === "verify") return v;
  return "login";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "request body must be JSON" },
      { status: 400 },
    );
  }

  if (typeof body.phone !== "string" || body.phone.trim() === "") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`phone` is required (string)" },
      { status: 400 },
    );
  }
  if (typeof body.code !== "string" || body.code.trim() === "") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`code` is required (string)" },
      { status: 400 },
    );
  }

  const hit = verifyOtpPhoneLimiter.hit(`phone:${body.phone.trim()}`);
  if (!hit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "too many attempts; try again later",
        retryAfterMs: hit.retryAfterMs,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(hit.retryAfterMs / 1000)) } },
    );
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    console.error("[auth:verify-otp] JWT_SECRET missing or too short");
    return NextResponse.json(
      { ok: false, code: "INTERNAL", message: "server misconfigured" },
      { status: 500 },
    );
  }

  try {
    const svc = getOtpService();
    const { userId, phone } = await svc.verify({
      phone: body.phone,
      code: body.code,
      purpose: parsePurpose(body.purpose),
    });

    const token = signJwt(
      { sub: userId, phone },
      {
        secret,
        expiresInSec: TOKEN_TTL_SEC,
        issuer: "masjidoasis",
        audience: "masjidoasis-web",
      },
    );

    return NextResponse.json({
      ok: true,
      token,
      user: { id: userId, phone },
    });
  } catch (err) {
    if (err instanceof OtpVerifyError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    console.error("[auth:verify-otp] unexpected error", err);
    return NextResponse.json(
      { ok: false, code: "INTERNAL", message: "internal error" },
      { status: 500 },
    );
  }
}
