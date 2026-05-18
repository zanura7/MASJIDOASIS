/**
 * POST /api/donations/webhook
 *
 * Midtrans payment notification for donations. Distinct from the
 * marketplace webhook at /api/webhooks/midtrans — that one resolves the
 * payload to a marketplace Order; this one resolves to a Donation by
 * `midtransOrderId`.
 *
 * Security: validates Midtrans SHA-512 signature.
 * Idempotency: handlePaymentNotification() short-circuits on already-PAID.
 *
 * No bearer auth (server-to-server callback).
 */

import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { checkMidtransNotificationSignature } from "@/server/payments/midtrans/signature";
import type { MidtransNotification } from "@/server/payments/midtrans/status";
import { makeDonationService } from "@/server/crowdfunding/factory";
import { DonationServiceError } from "@/server/crowdfunding/donation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return NextResponse.json(
      { ok: false, code: "BAD_BODY", message: "request body must be JSON" },
      { status: 400 },
    );
  }

  if (!isMidtransNotification(raw)) {
    return NextResponse.json(
      { ok: false, code: "BAD_SHAPE", message: "missing required Midtrans fields" },
      { status: 400 },
    );
  }
  const note: MidtransNotification = raw;

  const env = getEnv();
  const serverKey = env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    return NextResponse.json(
      {
        ok: false,
        code: "MIDTRANS_NOT_CONFIGURED",
        message: "MIDTRANS_SERVER_KEY not set",
      },
      { status: 503 },
    );
  }

  const sigCheck = checkMidtransNotificationSignature(note, serverKey);
  if (!sigCheck.ok) {
    return NextResponse.json(
      { ok: false, code: "BAD_SIGNATURE", message: "signature verification failed" },
      { status: 401 },
    );
  }

  try {
    const svc = makeDonationService();
    await svc.handlePaymentNotification(note.order_id, note.transaction_status);
    return NextResponse.json({
      ok: true,
      status: "acknowledged",
      orderId: note.order_id,
      transactionStatus: note.transaction_status,
    });
  } catch (err) {
    if (err instanceof DonationServiceError) {
      // DONATION_NOT_FOUND: this callback isn't for us — could be a
      // marketplace order. Return 404 so operator sees it; Midtrans will
      // not retry indefinitely.
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status: err.httpStatus },
      );
    }
    console.error("POST /api/donations/webhook error:", err);
    return NextResponse.json(
      { ok: false, code: "INTERNAL", message: "internal error" },
      { status: 500 },
    );
  }
}
