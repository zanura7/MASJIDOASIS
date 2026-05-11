/**
 * Order lifecycle state machine — MAS-34.
 *
 * Implements the canonical order flow:
 *
 *     PENDING  ──(payment webhook)──▶  PAID
 *     PAID     ──(seller marks shipped)──▶  SHIPPED
 *     SHIPPED  ──(buyer confirms received)──▶  DELIVERED
 *     SHIPPED  ──(auto-complete 7d after shippedAt)──▶  COMPLETED
 *     DELIVERED ──(immediate)──▶  COMPLETED
 *
 * Plus terminal transitions:
 *
 *     PENDING  ──(payment expires/fails)──▶  CANCELLED
 *
 * Design choices:
 *  - Transitions are guarded: invalid moves throw `OrderLifecycleError`
 *    rather than silently no-oping, so callers learn at compile + runtime
 *    when they ask for something the state machine forbids.
 *  - All transitions are **idempotent on the target state**: calling
 *    `markPaid` on an already-PAID order is a no-op (returns the existing
 *    row unchanged) — this is critical for webhook retries.
 *  - Authorisation is the route handler's job. The service trusts the
 *    `actorId` it receives and only verifies it matches the order
 *    participant (buyer-only / seller-only) the transition requires.
 *  - Side-effects (ledger writes, notifications) are deliberately NOT
 *    in this service. They will be wired by separate tickets
 *    (escrow/release lives in MAS-35+). This keeps the state machine
 *    pure and easy to test.
 *
 * The service uses a narrow `OrderLifecycleStore` interface (injected
 * via constructor) so unit tests can use an in-memory implementation,
 * and production code injects a Prisma adapter from `prisma-stores.ts`.
 */

import type { OrderRow } from "./checkout-service";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/** Lifecycle-extended Order row (adds the state-machine timestamps). */
export interface LifecycleOrderRow extends OrderRow {
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
}

export class OrderLifecycleError extends Error {
  readonly code:
    | "ORDER_NOT_FOUND"
    | "INVALID_TRANSITION"
    | "FORBIDDEN_ACTOR"
    | "WEBHOOK_ALREADY_PROCESSED"
    | "WEBHOOK_REPLAY_MISMATCH";
  readonly httpStatus: number;
  constructor(
    code: OrderLifecycleError["code"],
    httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "OrderLifecycleError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/* -------------------------------------------------------------------------- */
/* Store interface                                                            */
/* -------------------------------------------------------------------------- */

export interface OrderLifecycleStore {
  order: {
    findUnique(args: {
      where: { id: string };
    }): Promise<LifecycleOrderRow | null>;
    update(args: {
      where: { id: string };
      data: Partial<
        Pick<
          LifecycleOrderRow,
          | "status"
          | "paymentStatus"
          | "paidAt"
          | "shippedAt"
          | "deliveredAt"
          | "completedAt"
          | "cancelledAt"
          | "updatedAt"
        >
      >;
    }): Promise<LifecycleOrderRow>;
    findManyEligibleForAutoComplete(args: {
      shippedBefore: Date;
    }): Promise<LifecycleOrderRow[]>;
  };
  webhookEvent: {
    /**
     * Atomically claim a webhook by `(provider, externalId)`.
     *
     * Returns:
     *   - `{ alreadyProcessed: true }` if the row exists and
     *     `processedAt != null` (caller should treat as no-op success).
     *   - `{ alreadyProcessed: false, id }` after creating-or-claiming
     *     the row. Caller is responsible for calling `markProcessed`
     *     after the transition lands.
     */
    claim(args: {
      provider: string;
      externalId: string;
      payload: unknown;
      signature?: string | null;
    }): Promise<{ alreadyProcessed: true } | { alreadyProcessed: false; id: string }>;
    markProcessed(args: { id: string; at: Date }): Promise<void>;
  };
}

/* -------------------------------------------------------------------------- */
/* State machine (pure)                                                       */
/* -------------------------------------------------------------------------- */

/**
 * All transitions allowed by the state machine. The keys are the source
 * state; values are the set of target states reachable in one step.
 *
 * Exported for tests and for documenting the contract.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "REFUNDED"],
  SHIPPED: ["DELIVERED", "COMPLETED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUNDED: [],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  DISPUTED: ["REFUNDED", "COMPLETED"],
};

export function canTransition(from: string, to: string): boolean {
  if (from === to) return true; // idempotent no-op
  const next = ALLOWED_TRANSITIONS[from];
  if (!next) return false;
  return next.includes(to);
}

function assertTransition(from: string, to: string): void {
  if (!canTransition(from, to)) {
    throw new OrderLifecycleError(
      "INVALID_TRANSITION",
      409,
      `cannot transition order from ${from} to ${to}`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export interface MarkPaidInput {
  orderId: string;
  /** Payment provider (e.g. "midtrans"). Used for the webhook idempotency key. */
  provider: string;
  /** Provider-side unique event id. */
  externalId: string;
  /** Raw payload for audit/storage. */
  payload: unknown;
  /** Optional signature header for audit. */
  signature?: string | null;
  /** Optional explicit timestamp (defaults to now). Useful in tests. */
  now?: Date;
}

export interface MarkShippedInput {
  orderId: string;
  /** The seller user id performing the action. Must equal `order.sellerId`. */
  actorSellerId: string;
  now?: Date;
}

export interface ConfirmReceivedInput {
  orderId: string;
  /** The buyer user id performing the action. Must equal `order.buyerId`. */
  actorBuyerId: string;
  now?: Date;
}

export interface AutoCompleteInput {
  /**
   * Auto-complete window. Defaults to 7 days per product spec ("7 hari").
   */
  windowDays?: number;
  now?: Date;
  /** Cap the number of orders processed per sweep. Defaults to 100. */
  limit?: number;
}

export interface AutoCompleteResult {
  scanned: number;
  completed: string[];
}

/** Public service exposing the four lifecycle triggers. */
export class OrderLifecycleService {
  private readonly store: OrderLifecycleStore;
  constructor(deps: { db: OrderLifecycleStore }) {
    this.store = deps.db;
  }

  /**
   * PENDING → PAID, triggered by a payment-provider webhook.
   *
   * Idempotent on `(provider, externalId)`: if the same webhook is
   * delivered twice the second call is a no-op success.
   */
  async markPaid(input: MarkPaidInput): Promise<LifecycleOrderRow> {
    const now = input.now ?? new Date();

    // 1. Claim the webhook event row (atomic; second delivery → no-op).
    const claim = await this.store.webhookEvent.claim({
      provider: input.provider,
      externalId: input.externalId,
      payload: input.payload,
      signature: input.signature ?? null,
    });

    // Already processed earlier — return current order state as-is.
    if (claim.alreadyProcessed) {
      const order = await this.store.order.findUnique({
        where: { id: input.orderId },
      });
      if (!order) {
        throw new OrderLifecycleError(
          "ORDER_NOT_FOUND",
          404,
          `order ${input.orderId} not found`,
        );
      }
      return order;
    }

    // 2. Load order.
    const order = await this.store.order.findUnique({
      where: { id: input.orderId },
    });
    if (!order) {
      throw new OrderLifecycleError(
        "ORDER_NOT_FOUND",
        404,
        `order ${input.orderId} not found`,
      );
    }

    // 3. Idempotent on PAID: if order is already past PENDING but
    // payment row claim was fresh, that's a webhook replay for an
    // already-paid order — return the order untouched (after marking
    // the event as processed so we don't keep retrying).
    if (order.status !== "PENDING") {
      await this.store.webhookEvent.markProcessed({ id: claim.id, at: now });
      // If the order was already PAID/SHIPPED/etc, that's fine — webhook
      // retries are expected. Only reject hard contradictions.
      if (order.status === "CANCELLED" || order.status === "REFUNDED") {
        throw new OrderLifecycleError(
          "INVALID_TRANSITION",
          409,
          `cannot mark paid: order is ${order.status}`,
        );
      }
      return order;
    }

    // 4. PENDING → PAID.
    assertTransition(order.status, "PAID");
    const updated = await this.store.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paymentStatus: "PAID",
        paidAt: now,
        updatedAt: now,
      },
    });
    await this.store.webhookEvent.markProcessed({ id: claim.id, at: now });
    return updated;
  }

  /**
   * PAID → SHIPPED, triggered by the seller of the order.
   *
   * Authorisation: `actorSellerId` MUST equal `order.sellerId`.
   * Idempotent: calling on an already-SHIPPED order returns it
   * unchanged (no error).
   */
  async markShipped(input: MarkShippedInput): Promise<LifecycleOrderRow> {
    const now = input.now ?? new Date();
    const order = await this.store.order.findUnique({
      where: { id: input.orderId },
    });
    if (!order) {
      throw new OrderLifecycleError(
        "ORDER_NOT_FOUND",
        404,
        `order ${input.orderId} not found`,
      );
    }
    if (order.sellerId !== input.actorSellerId) {
      throw new OrderLifecycleError(
        "FORBIDDEN_ACTOR",
        403,
        "only the order seller can mark this order shipped",
      );
    }
    // Idempotent: already shipped (or further along) → return as-is.
    if (
      order.status === "SHIPPED" ||
      order.status === "DELIVERED" ||
      order.status === "COMPLETED"
    ) {
      return order;
    }
    assertTransition(order.status, "SHIPPED");
    return this.store.order.update({
      where: { id: order.id },
      data: { status: "SHIPPED", shippedAt: now, updatedAt: now },
    });
  }

  /**
   * SHIPPED → DELIVERED → COMPLETED, triggered by the buyer.
   *
   * Authorisation: `actorBuyerId` MUST equal `order.buyerId`.
   * Sets both `deliveredAt` and `completedAt` to `now` (buyer
   * confirmation is treated as the terminal step).
   * Idempotent on COMPLETED.
   */
  async confirmReceived(
    input: ConfirmReceivedInput,
  ): Promise<LifecycleOrderRow> {
    const now = input.now ?? new Date();
    const order = await this.store.order.findUnique({
      where: { id: input.orderId },
    });
    if (!order) {
      throw new OrderLifecycleError(
        "ORDER_NOT_FOUND",
        404,
        `order ${input.orderId} not found`,
      );
    }
    if (order.buyerId !== input.actorBuyerId) {
      throw new OrderLifecycleError(
        "FORBIDDEN_ACTOR",
        403,
        "only the order buyer can confirm receipt",
      );
    }
    if (order.status === "COMPLETED") return order;
    if (order.status !== "SHIPPED" && order.status !== "DELIVERED") {
      throw new OrderLifecycleError(
        "INVALID_TRANSITION",
        409,
        `cannot confirm receipt: order is ${order.status}`,
      );
    }
    return this.store.order.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        deliveredAt: order.deliveredAt ?? now,
        completedAt: now,
        updatedAt: now,
      },
    });
  }

  /**
   * Sweep SHIPPED orders whose `shippedAt` is older than the
   * auto-complete window and move them to COMPLETED.
   *
   * Intended for a cron / scheduler. Returns the list of orders that
   * were transitioned so the caller can log / notify.
   */
  async autoCompleteShipped(
    input: AutoCompleteInput = {},
  ): Promise<AutoCompleteResult> {
    const now = input.now ?? new Date();
    const windowDays = input.windowDays ?? 7;
    if (windowDays < 0) {
      throw new OrderLifecycleError(
        "INVALID_TRANSITION",
        400,
        "windowDays must be >= 0",
      );
    }
    const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const candidates = await this.store.order.findManyEligibleForAutoComplete({
      shippedBefore: cutoff,
    });
    const limit = input.limit ?? 100;
    const slice = candidates.slice(0, limit);
    const completedIds: string[] = [];
    for (const ord of slice) {
      if (ord.status !== "SHIPPED") continue; // defensive; store should pre-filter
      const updated = await this.store.order.update({
        where: { id: ord.id },
        data: {
          status: "COMPLETED",
          deliveredAt: ord.deliveredAt ?? now,
          completedAt: now,
          updatedAt: now,
        },
      });
      completedIds.push(updated.id);
    }
    return { scanned: candidates.length, completed: completedIds };
  }
}
