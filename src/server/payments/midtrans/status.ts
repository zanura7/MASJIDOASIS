/**
 * Midtrans notification → internal payment outcome mapping.
 *
 * Midtrans publishes ~10 `transaction_status` values across the payment
 * lifecycle. For escrow purposes we only care about three outcomes:
 *
 *   PAID      — money is in (we credit escrow, set Order.paymentStatus=PAID)
 *   FAILED    — terminal failure (deny / expire / cancel; we mark FAILED)
 *   PENDING   — non-terminal (waiting for buyer action; we ignore)
 *
 * `fraud_status` further narrows `capture` — only `accept` should
 * release funds.
 *
 * Reference: https://docs.midtrans.com/reference/transaction-status
 *
 * MAS-38.
 */

export type MidtransOutcome = "PAID" | "FAILED" | "PENDING";

export interface MidtransStatusFields {
  transaction_status: string;
  fraud_status?: string | null;
}

/**
 * Shape of a Midtrans notification payload the webhook route receives.
 *
 * Only the fields we actually consume are typed; Midtrans also sends
 * a long tail of payment-method-specific fields (`payment_type`, `va_numbers`,
 * `card_type`, etc.) which we accept but don't narrow.
 */
export interface MidtransNotification extends MidtransStatusFields {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_id: string;
  transaction_status: string;
  fraud_status?: string | null;
  // Provider may send any number of additional fields.
  [key: string]: unknown;
}

/**
 * Map a Midtrans notification's `transaction_status` (+ `fraud_status`)
 * to one of three internal outcomes.
 *
 * Unknown statuses default to PENDING — the safer choice, since FAILED
 * triggers refund logic and PAID releases escrow. Pending is no-op.
 */
export function mapMidtransOutcome(s: MidtransStatusFields): MidtransOutcome {
  const txn = (s.transaction_status ?? "").toLowerCase();
  const fraud = (s.fraud_status ?? "").toLowerCase();

  switch (txn) {
    case "settlement":
      // Card / bank transfer / e-wallet finalised.
      return "PAID";
    case "capture":
      // Card authorised; finalisation depends on fraud screening.
      // `accept` = green-lit, `challenge` = manual review (hold),
      // `deny` = blocked. Only accept releases funds.
      if (fraud === "accept") return "PAID";
      if (fraud === "deny") return "FAILED";
      return "PENDING";
    case "deny":
    case "cancel":
    case "expire":
    case "failure":
    case "refund":
    case "partial_refund":
    case "chargeback":
    case "partial_chargeback":
      return "FAILED";
    case "pending":
    case "authorize":
      return "PENDING";
    default:
      return "PENDING";
  }
}
