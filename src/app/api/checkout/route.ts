/**
 * POST /api/checkout/quote — preview seller-grouped totals + shipping.
 * POST /api/checkout       — commit: split cart into orders, decrement stock, clear cart.
 *
 * Both require auth. No role gating (any authenticated user with a cart can checkout).
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

interface CheckoutBody {
  service?: unknown;
  destination?: unknown;
  notes?: unknown;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;

  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
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
  const notes =
    body.notes === undefined || body.notes === null
      ? undefined
      : typeof body.notes === "string"
        ? body.notes
        : null;
  if (notes === null) {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`notes` must be string" },
      { status: 400 },
    );
  }

  try {
    const result = await getService().createOrders(auth.sub, {
      service: body.service,
      destination: body.destination as Parameters<
        CheckoutService["createOrders"]
      >[1]["destination"],
      notes,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    if (!(err instanceof Error)) console.error("[checkout:POST]", err);
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
