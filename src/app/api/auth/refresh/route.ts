/**
 * POST /api/auth/refresh — MAS-23.
 *
 * Body: { "refreshToken": "<opaque>" }
 *
 * Responses:
 *   200 → {
 *     ok: true,
 *     accessToken, refreshToken, expiresIn, refreshExpiresIn
 *   }
 *   400 → { ok: false, code: "BAD_BODY", message }
 *   401 → { ok: false, code: "INVALID_REFRESH" | "EXPIRED_REFRESH" | "REVOKED" | "REUSE_DETECTED", message }
 *
 * Rotates the refresh token (one-shot). The presented token is revoked
 * and a new pair is minted. Token reuse after rotation revokes ALL of
 * the user's outstanding sessions — see `TokenService.rotateRefreshToken`.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { TokenService, TokenError } from "@/server/auth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  refreshToken?: unknown;
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
  if (typeof body.refreshToken !== "string" || body.refreshToken.trim() === "") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`refreshToken` is required (string)" },
      { status: 400 },
    );
  }

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    console.error("[auth:refresh] JWT_SECRET missing or too short");
    return NextResponse.json(
      { ok: false, code: "INTERNAL", message: "server misconfigured" },
      { status: 500 },
    );
  }

  try {
    const tokens = new TokenService({ db: prisma, jwtSecret: secret });
    const pair = await tokens.rotateRefreshToken(body.refreshToken, {
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip"),
    });
    return NextResponse.json({
      ok: true,
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresIn: pair.expiresIn,
      refreshExpiresIn: pair.refreshExpiresIn,
    });
  } catch (err) {
    if (err instanceof TokenError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    console.error("[auth:refresh] unexpected error", err);
    return NextResponse.json(
      { ok: false, code: "INTERNAL", message: "internal error" },
      { status: 500 },
    );
  }
}
