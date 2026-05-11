/**
 * POST /api/checkout/quote — preview totals (subtotal + shipping per seller)
 * without committing.
 *
 * MAS-33.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuth, AuthError } from "@/server/auth/middleware";
import { prisma } from "@/server/db";
import { CheckoutService } from "@/server/marketplace/checkout-service";
import { buildCheckoutStore } from "@/server/marketplace/prisma-stores";
import {
  badJsonBody,
  marketplaceErrorToJson,
} from "@/server/marketplace/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getService(): CheckoutService {
  return new CheckoutService({ db: buildCheckoutStore(prisma) });
}

function authOrFail(req: NextRequest): { sub: string } | NextResponse {
  try {
    const claims = requireAuth(req);
    return { sub: claims.sub };
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    throw err;
  }
}

interface QuoteBody {
  service?: unknown;
  destination?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;

  let body: QuoteBody;
  try {
    body = (await req.json()) as QuoteBody;
  } catch {
    const j = badJsonBody();
    return NextResponse.json(j.body, { status: j.status });
  }

  if (body.service !== "REG" && body.service !== "SAME_DAY") {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`service` must be REG or SAME_DAY" },
      { status: 400 },
    );
  }

  try {
    const result = await getService().quote(auth.sub, {
      service: body.service,
      destination: body.destination as Parameters<CheckoutService["quote"]>[1]["destination"],
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
