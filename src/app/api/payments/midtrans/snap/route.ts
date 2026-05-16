/**
 * POST /api/payments/midtrans/snap
 *
 * Create a Midtrans Snap transaction token for an existing PENDING order
 * owned by the authenticated buyer. Returns `{ token, redirectUrl }` for
 * the client to open the Snap payment page.
 *
 * Flow:
 *   1. Auth check (buyer must own the order).
 *   2. Order must be in PENDING status.
 *   3. Mint a unique `midtransOrderId` = `<orderCode>-<attempt>` to support
 *      retries (Midtrans rejects duplicate order_id with HTTP 406).
 *   4. Call Midtrans Snap API with item details + amount.
 *   5. Persist `midtransOrderId` on the order so the webhook can match.
 *
 * MAS-38.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAuth, AuthError } from "@/server/auth/middleware";
import { prisma } from "@/server/db";
import {
  buildMidtransOrderId,
  loadMidtransConfig,
  parseMidtransOrderId,
} from "@/server/payments/midtrans/config";
import {
  createSnapTransaction,
  MidtransSnapError,
  type SnapItemDetail,
} from "@/server/payments/midtrans/snap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SnapRequestBody {
  orderId?: unknown;
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = authOrFail(req);
  if (auth instanceof NextResponse) return auth;

  let body: SnapRequestBody;
  try {
    body = (await req.json()) as SnapRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "request body must be JSON" },
      { status: 400 },
    );
  }

  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  if (!orderId) {
    return NextResponse.json(
      { ok: false, code: "BAD_PARAM", message: "orderId required" },
      { status: 400 },
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      code: true,
      buyerId: true,
      status: true,
      paymentStatus: true,
      totalCents: true,
      currency: true,
      midtransOrderId: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          priceCents: true,
          titleSnapshot: true,
        },
      },
    },
  });
  if (!order) {
    return NextResponse.json(
      { ok: false, code: "ORDER_NOT_FOUND", message: "order not found" },
      { status: 404 },
    );
  }
  if (order.buyerId !== auth.sub) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", message: "not the buyer of this order" },
      { status: 403 },
    );
  }
  if (order.status !== "PENDING") {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_STATE",
        message: `order must be PENDING to create a Snap transaction, got ${order.status}`,
      },
      { status: 409 },
    );
  }

  // Determine the attempt counter so we can mint a fresh Midtrans order_id
  // on each retry (Midtrans rejects re-used ids).
  const previous = order.midtransOrderId
    ? parseMidtransOrderId(order.midtransOrderId)
    : null;
  const attempt = previous && previous.orderCode === order.code ? previous.attempt + 1 : 1;
  const midtransOrderId = buildMidtransOrderId(order.code, attempt);

  // Validate amount.
  const amountCentsNum = Number(order.totalCents);
  if (!Number.isFinite(amountCentsNum) || amountCentsNum <= 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "BAD_AMOUNT",
        message: "order has non-positive total — cannot create payment",
      },
      { status: 422 },
    );
  }

  // Build item_details from OrderItem rows. Midtrans expects rupiah (not cents).
  // OrderItem.priceCents is Int (rupiah cents), titleSnapshot is the product name at order time.
  const itemDetails: SnapItemDetail[] = order.items.map((it) => {
    const name =
      typeof it.titleSnapshot === "string" && it.titleSnapshot.length > 0
        ? it.titleSnapshot
        : `Product ${it.productId}`;
    return {
      id: it.productId,
      // priceCents is Int — divide by 100 for rupiah. Clamp 50-char Midtrans name limit.
      price: it.priceCents / 100,
      quantity: it.quantity,
      name: name.slice(0, 50),
    };
  });

  if (itemDetails.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        code: "EMPTY_ORDER",
        message: "order has no items — cannot create payment",
      },
      { status: 422 },
    );
  }

  try {
    const config = loadMidtransConfig();
    const tx = await createSnapTransaction(
      {
        orderId: midtransOrderId,
        amountCents: amountCentsNum,
        itemDetails,
        customerDetail: {
          first_name: order.buyerId.slice(0, 20), // placeholder; replace with real buyer info if available
        },
      },
      config,
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { midtransOrderId },
    });

    return NextResponse.json({
      ok: true,
      token: tx.token,
      redirectUrl: tx.redirect_url,
      midtransOrderId,
    });
  } catch (err) {
    if (err instanceof MidtransSnapError) {
      return NextResponse.json(
        {
          ok: false,
          code: "MIDTRANS_ERROR",
          message: err.message,
          status: err.status,
        },
        { status: 502 },
      );
    }
    if (err instanceof Error && /MIDTRANS_SERVER_KEY/.test(err.message)) {
      return NextResponse.json(
        {
          ok: false,
          code: "MIDTRANS_NOT_CONFIGURED",
          message: "Midtrans is not configured on this server",
        },
        { status: 503 },
      );
    }
    throw err;
  }
}
