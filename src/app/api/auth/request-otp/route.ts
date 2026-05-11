/**
 * POST /api/auth/request-otp — MAS-22.
 *
 * Body: { "phone": "+62…" | "08…", "purpose"?: "login" | "reset" | "verify" }
 *
 * Responses:
 *   200 → { ok: true, expiresInSec, channel }
 *   400 → { ok: false, code: "INVALID_PHONE" | "BAD_BODY", message }
 *   429 → { ok: false, code: "RATE_LIMITED", retryAfterMs, message }
 *   502 → { ok: false, code: "PROVIDER_ERROR", message } — outbound API down.
 *
 * Rate limits (per `src/server/auth/rate-limit.ts`):
 *   - 5 requests per 10 min per phone
 *   - 20 requests per hour per source IP (loose, applied first)
 *
 * Privacy note: we deliberately return success without revealing whether
 * the phone already maps to an existing user. The OTP itself does NOT
 * appear in the response in any environment (use the provider channel).
 */

import { NextRequest, NextResponse } from "next/server";

import { getOtpService } from "@/server/auth/otp-service-singleton";
import { OtpRequestError, type OtpPurpose } from "@/server/auth/otp-service";
import { requestOtpIpLimiter, requestOtpPhoneLimiter } from "@/server/auth/rate-limit";
import { OtpDeliveryError } from "@/server/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  phone?: unknown;
  purpose?: unknown;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd && fwd.trim() !== "") return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real && real.trim() !== "") return real.trim();
  return "unknown";
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

  const ip = clientIp(req);
  const ipHit = requestOtpIpLimiter.hit(`ip:${ip}`);
  if (!ipHit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "too many requests from this network",
        retryAfterMs: ipHit.retryAfterMs,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipHit.retryAfterMs / 1000)) } },
    );
  }

  const phoneHit = requestOtpPhoneLimiter.hit(`phone:${body.phone.trim()}`);
  if (!phoneHit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        code: "RATE_LIMITED",
        message: "too many requests for this phone; try again later",
        retryAfterMs: phoneHit.retryAfterMs,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(phoneHit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const svc = getOtpService();
    const result = await svc.request({
      phone: body.phone,
      purpose: parsePurpose(body.purpose),
    });
    return NextResponse.json({
      ok: true,
      expiresInSec: result.expiresInSec,
      channel: result.channel,
    });
  } catch (err) {
    if (err instanceof OtpRequestError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    if (err instanceof OtpDeliveryError) {
      // Don't leak provider response bodies.
      return NextResponse.json(
        { ok: false, code: "PROVIDER_ERROR", message: "could not deliver OTP; try again shortly" },
        { status: 502 },
      );
    }
    // Unknown error — log server-side, never echo to client.
    console.error("[auth:request-otp] unexpected error", err);
    return NextResponse.json(
      { ok: false, code: "INTERNAL", message: "internal error" },
      { status: 500 },
    );
  }
}
