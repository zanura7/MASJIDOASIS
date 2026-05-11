/**
 * POST /api/orders/[id]/ship
 *
 * Seller marks an order as shipped (PAID → SHIPPED). No body required.
 * Shipment tracking details (carrier, tracking number) are managed
 * through the Shipment model in a separate ticket — this endpoint
 * only advances the order state machine.
 *
 * Requires auth. Caller MUST be the order's seller.
 *
 * MAS-34.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuth, AuthError } from "@/server/auth/middleware";
import { prisma } from "@/server/db";
import { OrderLifecycleService } from "@/server/marketplace/order-lifecycle-service";
import { buildOrderLifecycleStore } from "@/server/marketplace/prisma-stores";
import { marketplaceErrorToJson } from "@/server/marketplace/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getService(): OrderLifecycleService {
  return new OrderLifecycleService({ db: buildOrderLifecycleStore(prisma) });
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

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;

  const { id: orderId } = await ctx.params;
  if (!orderId) {
    return NextResponse.json(
      { ok: false, code: "BAD_PARAM", message: "order id required" },
      { status: 400 },
    );
  }

  try {
    const order = await getService().markShipped({
      orderId,
      actorSellerId: auth.sub,
    });
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
