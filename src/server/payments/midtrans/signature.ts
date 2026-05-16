/**
 * Midtrans webhook signature verification.
 *
 * Midtrans signs every webhook notification with:
 *
 *   signature_key = SHA512(order_id + status_code + gross_amount + server_key)
 *
 * Reference: https://docs.midtrans.com/reference/notification-overview#signature-key
 *
 * The server MUST verify the `signature_key` field of every notification
 * body matches a recomputed digest using its private `server_key` BEFORE
 * trusting any other field. Without this check an attacker can forge
 * "payment succeeded" notifications and trigger fund release.
 *
 * MAS-38.
 */

import { createHash, timingSafeEqual } from "node:crypto";

export interface MidtransSignatureInput {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
}

/**
 * Compute the expected SHA-512 hex digest for a Midtrans notification.
 *
 * Inputs are concatenated AS-IS (no separator, no transformation). The
 * caller is responsible for passing the exact field values Midtrans sent
 * in the notification body — in particular `gross_amount` arrives as a
 * string like `"10000.00"`, NOT a number, and the original string is
 * what gets hashed.
 */
export function computeMidtransSignature(
  input: MidtransSignatureInput,
): string {
  const payload =
    input.orderId + input.statusCode + input.grossAmount + input.serverKey;
  return createHash("sha512").update(payload, "utf8").digest("hex");
}

/**
 * Constant-time comparison of a received signature against the expected
 * one. Returns `true` iff the signatures match.
 *
 * Uses `crypto.timingSafeEqual` to prevent timing side-channels on the
 * comparison itself. Returns `false` (rather than throwing) on length
 * mismatch since `timingSafeEqual` throws if the buffers differ in size.
 */
export function verifyMidtransSignature(
  received: string,
  expected: string,
): boolean {
  // Defensive: empty / non-string received → always false.
  if (typeof received !== "string" || received.length === 0) return false;

  // SHA-512 hex digest is always 128 chars. If we got something else,
  // it's definitely wrong — bail without invoking timingSafeEqual (which
  // would throw on length mismatch).
  if (received.length !== expected.length) return false;

  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

/**
 * Convenience: verify a Midtrans notification body against a server key.
 *
 * Returns `{ ok: true }` if `body.signature_key` matches the recomputed
 * digest. Returns `{ ok: false, expected, received }` otherwise so the
 * caller can log the mismatch (the body is then almost certainly
 * malicious or corrupted).
 */
export interface MidtransNotificationBody {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  // ...plus many other fields we don't need for signature verification.
}

export type SignatureCheckResult =
  | { ok: true }
  | { ok: false; expected: string; received: string };

export function checkMidtransNotificationSignature(
  body: MidtransNotificationBody,
  serverKey: string,
): SignatureCheckResult {
  const expected = computeMidtransSignature({
    orderId: body.order_id,
    statusCode: body.status_code,
    grossAmount: body.gross_amount,
    serverKey,
  });
  if (verifyMidtransSignature(body.signature_key, expected)) {
    return { ok: true };
  }
  return { ok: false, expected, received: body.signature_key };
}
