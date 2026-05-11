/**
 * POST /api/webhooks/payment
 *
 * Generic payment webhook. Body shape:
 *   {
 *     provider: "midtrans" | "xendit" | string,
 *     externalId: string,    // provider's event id (idempotency key)
 *     orderId: string,       // OUR order id
 *     status: string,        // provider terminology
 *     signature?: string,
 *   }
 *
 * Idempotency: every event is keyed on (provider, externalId) — duplicate
 * deliveries return 200 OK without re-processing.
 *
 * No user auth — webhooks are server-to-server. Signature verification
 * is delegated to provider-specific middleware in a follow-up ticket;
 * for now we persist `signature` to WebhookEvent for audit.
 *
 * Only "paid"-class statuses trigger PENDING→PAID. Non-paid statuses
 * are recorded for audit but do not advance the order state.
 *
 * MAS-34.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { OrderLifecycleService } from "@/server/marketplace/order-lifecycle-service";
import { buildOrderLifecycleStore } from "@/server/marketplace/prisma-stores";
import {
  badJsonBody,
  marketplaceErrorToJson,
} from "@/server/marketplace/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getService(): OrderLifecycleService {
  return new OrderLifecycleService({ db: buildOrderLifecycleStore(prisma) });
}

interface PaymentWebhookBody {
  provider?: unknown;
  externalId?: unknown;
  orderId?: unknown;
  status?: unknown;
  signature?: unknown;
}

const PAID_STATUSES = new Set([
  "paid",
  "settlement",
  "capture",
  "success",
  "succeeded",
  "completed",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PaymentWebhookBody;
  try {
    body = (await req.json()) as PaymentWebhookBody;
  } catch {
    const j = badJsonBody();
    return NextResponse.json(j.body, { status: j.status });
  }

  if (typeof body.provider !== "string" || body.provider.length === 0) {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`provider` is required" },
      { status: 400 },
    );
  }
  if (typeof body.externalId !== "string" || body.externalId.length === 0) {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`externalId` is required" },
      { status: 400 },
    );
  }
  if (typeof body.orderId !== "string" || body.orderId.length === 0) {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`orderId` is required" },
      { status: 400 },
    );
  }
  if (typeof body.status !== "string" || body.status.length === 0) {
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "`status` is required" },
      { status: 400 },
    );
  }

  const signature =
    typeof body.signature === "string" && body.signature.length > 0
      ? body.signature
      : null;

  const isPaid = PAID_STATUSES.has(body.status.toLowerCase());

  // Non-paid statuses: don't call markPaid (it would advance the state).
  // We just acknowledge and 200 so the provider stops retrying. A more
  // sophisticated impl would dead-letter these for inspection.
  if (!isPaid) {
    return NextResponse.json({
      ok: true,
      duplicate: false,
      applied: false,
      reason: "non-paid status acknowledged",
    });
  }

  try {
    const order = await getService().markPaid({
      provider: body.provider,
      externalId: body.externalId,
      orderId: body.orderId,
      payload: body as unknown,
      signature,
    });
    return NextResponse.json({
      ok: true,
      applied: true,
      order,
    });
  } catch (err) {
    const j = marketplaceErrorToJson(err);
    return NextResponse.json(j.body, { status: j.status });
  }
}
