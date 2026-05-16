/**
 * Midtrans Snap API client — create a Snap transaction token.
 *
 * Snap is Midtrans's hosted payment page. The flow:
 *
 *   1. Server POSTs transaction details to /snap/v1/transactions with
 *      HTTP Basic auth (server_key + ":"). Body must contain a unique
 *      `transaction_details.order_id` we control — we use this same
 *      value to look up the order when the webhook arrives.
 *   2. Midtrans responds with `{ token, redirect_url }`.
 *   3. Client opens `redirect_url` or instantiates Snap JS with `token`.
 *   4. Buyer completes payment.
 *   5. Midtrans POSTs a notification to our webhook (see
 *      /api/webhooks/midtrans/route.ts).
 *
 * Reference:
 *   https://docs.midtrans.com/reference/getting-started-snap
 *   https://api-docs.midtrans.com/#charge-features
 *
 * MAS-38.
 */

export interface SnapItemDetail {
  id: string;
  price: number;
  quantity: number;
  name: string;
}

export interface SnapCustomerDetail {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

export interface CreateSnapTransactionInput {
  /** Unique transaction id we control. Use Order.id or Order.code. */
  orderId: string;
  /** Total in IDR cents — will be divided by 100 for Midtrans (which expects rupiah). */
  amountCents: number;
  itemDetails: SnapItemDetail[];
  customerDetail?: SnapCustomerDetail;
}

export interface SnapTransactionResponse {
  token: string;
  redirect_url: string;
}

export interface MidtransSnapConfig {
  /** Midtrans server key (private). NEVER ship to client. */
  serverKey: string;
  /**
   * `true` → use https://app.midtrans.com/snap/v1/transactions
   * `false` → use https://app.sandbox.midtrans.com/snap/v1/transactions
   */
  isProduction: boolean;
  /** Optional custom fetch (for tests). Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

export class MidtransSnapError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "MidtransSnapError";
    this.status = status;
    this.body = body;
  }
}

function snapBaseUrl(isProduction: boolean): string {
  return isProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";
}

function basicAuthHeader(serverKey: string): string {
  // Midtrans uses HTTP Basic with `serverKey:` (note trailing colon = empty password).
  const encoded = Buffer.from(`${serverKey}:`).toString("base64");
  return `Basic ${encoded}`;
}

/**
 * Create a Snap transaction. Returns the Snap token + redirect URL.
 *
 * On non-2xx response, throws `MidtransSnapError` carrying the response
 * body for logging. Network errors propagate as-is.
 *
 * Idempotency: Midtrans rejects a second create for the same
 * `transaction_details.order_id` with HTTP 406. Callers handling
 * "buyer asked to retry payment on an order whose Snap token expired"
 * should generate a fresh `orderId` value (e.g. by appending a suffix)
 * — we don't try to be clever here.
 */
export async function createSnapTransaction(
  input: CreateSnapTransactionInput,
  config: MidtransSnapConfig,
): Promise<SnapTransactionResponse> {
  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new MidtransSnapError(
      `amountCents must be a positive number, got ${input.amountCents}`,
      400,
      null,
    );
  }
  if (!Array.isArray(input.itemDetails) || input.itemDetails.length === 0) {
    throw new MidtransSnapError(
      "itemDetails must be a non-empty array",
      400,
      null,
    );
  }

  // Midtrans expects rupiah, not cents. We use *Cents internally to
  // stay consistent with the rest of the codebase, so divide here.
  // Validate exact divisibility — the marketplace fee math should
  // already produce whole-rupiah totals.
  if (input.amountCents % 100 !== 0) {
    throw new MidtransSnapError(
      `amountCents must be a multiple of 100, got ${input.amountCents}`,
      400,
      null,
    );
  }
  const grossAmount = Math.floor(input.amountCents / 100);

  // Sanity check: sum(item.price * item.quantity) MUST equal gross_amount.
  // Midtrans rejects mismatches with HTTP 400.
  const itemsSum = input.itemDetails.reduce(
    (acc, it) => acc + it.price * it.quantity,
    0,
  );
  if (itemsSum !== grossAmount) {
    throw new MidtransSnapError(
      `itemDetails sum (${itemsSum}) does not equal gross_amount (${grossAmount})`,
      400,
      null,
    );
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const url = snapBaseUrl(config.isProduction);

  const body = {
    transaction_details: {
      order_id: input.orderId,
      gross_amount: grossAmount,
    },
    item_details: input.itemDetails,
    customer_details: input.customerDetail ?? undefined,
  };

  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: basicAuthHeader(config.serverKey),
    },
    body: JSON.stringify(body),
  });

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    // Non-JSON body — keep `parsed=null`.
  }

  if (!res.ok) {
    throw new MidtransSnapError(
      `Midtrans Snap create failed: HTTP ${res.status}`,
      res.status,
      parsed,
    );
  }

  // Midtrans success body: { token, redirect_url }
  if (
    parsed == null ||
    typeof parsed !== "object" ||
    typeof (parsed as Record<string, unknown>).token !== "string" ||
    typeof (parsed as Record<string, unknown>).redirect_url !== "string"
  ) {
    throw new MidtransSnapError(
      "Midtrans Snap create: malformed success response",
      res.status,
      parsed,
    );
  }

  return parsed as SnapTransactionResponse;
}
