/**
 * Midtrans environment + helpers.
 *
 * Centralises:
 *   - Reading MIDTRANS_* env vars via `getEnv()` so a missing server key
 *     fails fast at boot (in production) rather than at first webhook.
 *   - Building a deterministic `midtransOrderId` for an order — Midtrans
 *     requires this be unique across the merchant account, so we use the
 *     internal order code (e.g. `ORD-20260512-001`) plus a short retry suffix
 *     when callers want to regenerate after a previous attempt expired.
 *
 * Snap and the webhook handler both go through here so we have ONE place
 * to mock in tests.
 *
 * MAS-38.
 */

import { getEnv } from "@/lib/env";

import type { MidtransSnapConfig } from "./snap";

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

export interface MidtransConfig extends MidtransSnapConfig {
  /** Webhook receiver path — used for audit logging only. */
  webhookPath: string;
}

export function loadMidtransConfig(): MidtransConfig {
  const env = getEnv();
  const serverKey = env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error(
      "MIDTRANS_SERVER_KEY is not configured — refusing to call Midtrans API",
    );
  }
  return {
    serverKey,
    isProduction: env.MIDTRANS_IS_PRODUCTION === "true",
    webhookPath: "/api/webhooks/midtrans",
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Build a Midtrans-side `order_id` from our internal order. Midtrans requires
 * uniqueness across the merchant account; if a buyer abandons the Snap page
 * and tries again, the second `createTransaction` call must use a different
 * `order_id` or Midtrans returns `406 duplicate order id`.
 *
 * Strategy: `<orderCode>-<attempt>` where attempt starts at 1 and increments
 * each time the caller asks for a new token. Stored on `Order.midtransOrderId`.
 */
export function buildMidtransOrderId(orderCode: string, attempt: number): string {
  if (attempt < 1 || !Number.isInteger(attempt)) {
    throw new Error(`buildMidtransOrderId: attempt must be a positive integer, got ${attempt}`);
  }
  return `${orderCode}-${attempt}`;
}

/**
 * Parse `<orderCode>-<attempt>` back to its parts. Returns `null` if the input
 * does not match the expected shape — caller treats that as "this webhook is
 * not for an order we created".
 */
export function parseMidtransOrderId(
  midtransOrderId: string,
): { orderCode: string; attempt: number } | null {
  const m = midtransOrderId.match(/^(.+)-(\d+)$/);
  if (!m) return null;
  return { orderCode: m[1]!, attempt: Number(m[2]!) };
}
