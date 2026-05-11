/**
 * POST /api/auth/verify-otp — MAS-22 (extended in MAS-23).
 *
 * Body: { "phone": "+62…" | "08…", "code": "123456", "purpose"?: "login" | "reset" | "verify" }
 *
 * Responses:
 *   200 → {
 *     ok: true,
 *     accessToken, refreshToken, expiresIn, refreshExpiresIn,
 *     user: { id, phone, role }
 *   }
 *   400 → { ok: false, code: "BAD_BODY" | "MALFORMED", message }
 *   401 → { ok: false, code: "INVALID_CODE", message }
 *   404 → { ok: false, code: "NOT_FOUND", message }
 *   410 → { ok: false, code: "EXPIRED", message }
 *   429 → { ok: false, code: "RATE_LIMITED" | "MAX_ATTEMPTS", message }
 *
 * Behaviour:
 *   1. Rate-limit per phone (10 / 5 min) over the OTP-service's own 5-attempt cap.
 *   2. On a valid code: upsert the user (handled inside OtpService), fetch
 *      the user's current role, then mint an access JWT (15 min) AND a
 *      refresh token (30 d) backed by a new `Session` row.
 *
 * The legacy `token` field is also returned (= accessToken) for backwards
 * compatibility with clients written against MAS-22; remove once all
 * clients have switched to `accessToken`.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { getOtpService } from "@/server/auth/otp-service-singleton";
import { OtpVerifyError, type OtpPurpose } from "@/server/auth/otp-service";
import { verifyOtpPhoneLimiter } from "@/server/auth/rate-limit";
import { TokenService } from "@/server/auth/tokens";
import { isAppRole } from "@/server/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // Re-fetch the user to read the current role + status. OtpService.upsert
    // does not return these and we don't want to widen its surface.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, role: true, status: true },
    });
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, code: "FORBIDDEN", message: "user is not active" },
        { status: 403 },
      );
    }
    if (!isAppRole(user.role)) {
      console.error("[auth:verify-otp] user has unknown role", user.role);
      return NextResponse.json(
        { ok: false, code: "INTERNAL", message: "user role misconfigured" },
        { status: 500 },
      );
    }

    const tokens = new TokenService({ db: prisma, jwtSecret: secret });
    const pair = await tokens.issueTokenPair({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
    });

    return NextResponse.json({
      ok: true,
      // Legacy alias — MAS-22 clients consume `token`. Remove after migration.
      token: pair.accessToken,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresIn: pair.expiresIn,
      refreshExpiresIn: pair.refreshExpiresIn,
      user: { id: user.id, phone: user.phone, role: user.role },
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
