/**
 * POST /api/webhooks/midtrans
 *
 * Midtrans payment notification receiver.
 *
 * Security:
 *   - Validates Midtrans `signature_key` = SHA512(order_id + status_code +
 *     gross_amount + server_key). Mismatched or missing signature → 401.
 *
 * Idempotency:
 *   - Webhook delivery is provider-scoped idempotent via
 *     `WebhookEvent.@@unique([provider, externalId])` — see MAS-34's
 *     `OrderLifecycleService.markPaid`. Re-delivery of the same
 *     (provider="midtrans", externalId=transaction_id) is a no-op.
 *   - Ledger transfer is idempotent via `idempotencyKey =
 *     "midtrans:<transaction_id>:escrow"`. A retry after a partial failure
 *     re-uses the existing transfer rather than double-crediting.
 *
 * Atomicity:
 *   - `markPaid` runs the order state transition + WebhookEvent insert in a
 *     single `db.tx()` (MAS-34 contract).
 *   - The ledger transfer is a *separate* atomic transaction (DEBIT+CREDIT
 *     pair inside `ledgerStore.tx`), but is keyed off the same external id
 *     so retries converge.
 *
 * MAS-38.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { OrderLifecycleService } from "@/server/marketplace/order-lifecycle-service";
import {
  buildOrderLifecycleStore,
  buildLedgerStoreFromPrisma,
} from "@/server/marketplace/prisma-stores";
import { LedgerService, LedgerError } from "@/server/wallet/ledger-service";
import { checkMidtransNotificationSignature } from "@/server/payments/midtrans/signature";
import { mapMidtransOutcome, type MidtransNotification } from "@/server/payments/midtrans/status";
import { parseMidtransOrderId } from "@/server/payments/midtrans/config";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER = "midtrans";

function jsonError(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ ok: false, code, message, ...(extra ?? {}) }, { status });
}

function isMidtransNotification(v: unknown): v is MidtransNotification {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.order_id === "string" &&
    typeof o.status_code === "string" &&
    typeof o.gross_amount === "string" &&
    typeof o.transaction_status === "string" &&
    typeof o.signature_key === "string"
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("BAD_BODY", "request body must be JSON", 400);
  }

  if (!isMidtransNotification(raw)) {
    return jsonError("BAD_SHAPE", "missing required Midtrans notification fields", 400);
  }
  const note: MidtransNotification = raw;

  const env = getEnv();
  const serverKey = env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return jsonError(
      "MIDTRANS_NOT_CONFIGURED",
      "MIDTRANS_SERVER_KEY not set — webhook cannot verify signatures",
      503,
    );
  }

  const sigCheck = checkMidtransNotificationSignature(note, serverKey);
  if (!sigCheck.ok) {
    return jsonError("BAD_SIGNATURE", "Midtrans signature verification failed", 401, {
      expected: sigCheck.expected,
      received: sigCheck.received,
    });
  }

  const parsed = parseMidtransOrderId(note.order_id);
  if (!parsed) {
    return jsonError("BAD_ORDER_ID", `cannot parse Midtrans order_id "${note.order_id}"`, 400);
  }

  // Find the internal order by midtransOrderId. We don't look up by orderCode
  // alone because a previous attempt for the same order may have a stale
  // midtransOrderId and we want to fail loudly if the IDs are out of sync.
  const order = await prisma.order.findUnique({
    where: { midtransOrderId: note.order_id },
    select: {
      id: true,
      code: true,
      buyerId: true,
      totalCents: true,
      currency: true,
      status: true,
      paymentStatus: true,
    },
  });
  if (!order) {
    return jsonError(
      "ORDER_NOT_FOUND",
      `no order matches midtransOrderId "${note.order_id}"`,
      404,
    );
  }

  const outcome = mapMidtransOutcome(note);

  // For non-paid outcomes (pending, denied, expired, cancel, refund) we ACK
  // 200 so Midtrans stops retrying, but do NOT touch the state machine.
  // Refund/expire handling is a separate ticket (MAS-39+).
  if (outcome !== "PAID") {
    return NextResponse.json({
      ok: true,
      status: "acknowledged",
      outcome,
      orderId: order.id,
    });
  }

  // Validate gross_amount matches our stored total. Midtrans returns
  // gross_amount as a decimal string in rupiah (e.g. "150000.00").
  const expectedGross =
    order.currency === "IDR" ? Number(order.totalCents) / 100 : Number(order.totalCents);
  const reportedGross = Number(note.gross_amount);
  if (!Number.isFinite(reportedGross) || Math.abs(reportedGross - expectedGross) > 0.01) {
    return jsonError(
      "AMOUNT_MISMATCH",
      `Midtrans gross_amount ${note.gross_amount} does not match expected ${expectedGross}`,
      422,
    );
  }

  // --- Step 1: advance the order state machine (idempotent via WebhookEvent).
  const orderService = new OrderLifecycleService({
    db: buildOrderLifecycleStore(prisma),
  });

  let markPaidThrew = false;
  try {
    await orderService.markPaid({
      provider: PROVIDER,
      externalId: note.transaction_id,
      orderId: order.id,
      payload: note,
      signature: note.signature_key,
    });
  } catch (err) {
    markPaidThrew = true;
    // markPaid throws OrderLifecycleError with .code; map to JSON.
    const e = err as { code?: string; message?: string; httpStatus?: number };
    // WEBHOOK_ALREADY_PROCESSED is success-shaped — already done.
    if (e.code === "WEBHOOK_ALREADY_PROCESSED") {
      // Fall through; the ledger transfer (below) is also idempotent so
      // double-delivery is safe.
      markPaidThrew = false;
    } else {
      return jsonError(
        e.code ?? "MARK_PAID_FAILED",
        e.message ?? "failed to mark order paid",
        e.httpStatus ?? 500,
      );
    }
  }

  if (markPaidThrew) {
    // Defensive — shouldn't reach here, but explicit.
    return jsonError("MARK_PAID_FAILED", "failed to mark order paid", 500);
  }

  // --- Step 2: ledger transfer SYSTEM → buyer's USER_ESCROW (idempotent).
  // SYSTEM accounts allow negative balances by convention; payment funds enter
  // the platform's books via SYSTEM and are held against the buyer's escrow
  // account until the order COMPLETES (when MAS-XX will move escrow → seller's
  // USER_BALANCE) or REFUNDS (escrow → SYSTEM).
  const ledger = new LedgerService({
    store: buildLedgerStoreFromPrisma(prisma),
    enforceNonNegative: false,
  });

  try {
    const systemAcct = await ledger.ensureAccount({ userId: null, type: "SYSTEM" });
    const escrowAcct = await ledger.ensureAccount({
      userId: order.buyerId,
      type: "USER_ESCROW",
    });
    await ledger.transfer({
      fromAccountId: systemAcct.id,
      toAccountId: escrowAcct.id,
      amountCents: BigInt(order.totalCents),
      reason: "ORDER_PAYMENT",
      orderId: order.id,
      idempotencyKey: `midtrans:${note.transaction_id}:escrow`,
      meta: {
        provider: PROVIDER,
        transactionId: note.transaction_id,
        midtransOrderId: note.order_id,
      },
    });
  } catch (err) {
    if (err instanceof LedgerError) {
      // Surface the ledger error but DON'T 5xx — markPaid is already
      // committed and a retry will re-attempt the idempotent transfer.
      // Telling Midtrans to retry (4xx/5xx) would loop forever on a
      // truly bad state. Operators see the LedgerError via logs.
      console.error("[midtrans-webhook] ledger transfer failed", {
        orderId: order.id,
        externalId: note.transaction_id,
        code: err.code,
        message: err.message,
      });
      return NextResponse.json(
        {
          ok: true,
          status: "paid_pending_ledger",
          orderId: order.id,
          warning: `ledger transfer deferred: ${err.code}`,
        },
        { status: 200 },
      );
    }
    throw err;
  }

  return NextResponse.json({
    ok: true,
    status: "paid",
    orderId: order.id,
    transactionId: note.transaction_id,
  });
}
