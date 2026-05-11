import { describe, it, expect, beforeEach } from "vitest";

import {
  OrderLifecycleService,
  OrderLifecycleError,
  canTransition,
  ALLOWED_TRANSITIONS,
  type OrderLifecycleStore,
  type LifecycleOrderRow,
} from "./order-lifecycle-service";

/* -------------------------------------------------------------------------- */
/* In-memory store                                                            */
/* -------------------------------------------------------------------------- */

interface MemDb {
  orders: Map<string, LifecycleOrderRow>;
  webhooks: Map<string, { id: string; processedAt: Date | null }>;
}

function makeStore(db: MemDb): OrderLifecycleStore {
  let seq = 0;
  return {
    order: {
      async findUnique({ where }) {
        return db.orders.get(where.id) ?? null;
      },
      async update({ where, data }) {
        const cur = db.orders.get(where.id);
        if (!cur) throw new Error(`mem-store: order ${where.id} missing`);
        const next: LifecycleOrderRow = {
          ...cur,
          ...data,
          // Keep nullable timestamps explicitly defined as either Date or null.
          paidAt: data.paidAt !== undefined ? data.paidAt : cur.paidAt,
          shippedAt:
            data.shippedAt !== undefined ? data.shippedAt : cur.shippedAt,
          deliveredAt:
            data.deliveredAt !== undefined ? data.deliveredAt : cur.deliveredAt,
          completedAt:
            data.completedAt !== undefined ? data.completedAt : cur.completedAt,
          cancelledAt:
            data.cancelledAt !== undefined ? data.cancelledAt : cur.cancelledAt,
          status: data.status ?? cur.status,
          paymentStatus: data.paymentStatus ?? cur.paymentStatus,
          updatedAt: data.updatedAt ?? cur.updatedAt,
        };
        db.orders.set(where.id, next);
        return next;
      },
      async findManyEligibleForAutoComplete({ shippedBefore }) {
        const out: LifecycleOrderRow[] = [];
        for (const o of db.orders.values()) {
          if (
            o.status === "SHIPPED" &&
            o.shippedAt &&
            o.shippedAt < shippedBefore
          ) {
            out.push(o);
          }
        }
        return out;
      },
    },
    webhookEvent: {
      async claim({ provider, externalId }) {
        const key = `${provider}::${externalId}`;
        const existing = db.webhooks.get(key);
        if (existing) {
          if (existing.processedAt !== null) {
            return { alreadyProcessed: true };
          }
          return { alreadyProcessed: false, id: existing.id };
        }
        const id = `wh_${++seq}`;
        db.webhooks.set(key, { id, processedAt: null });
        return { alreadyProcessed: false, id };
      },
      async markProcessed({ id, at }) {
        for (const [k, v] of db.webhooks.entries()) {
          if (v.id === id) {
            db.webhooks.set(k, { id, processedAt: at });
            return;
          }
        }
        throw new Error(`mem-store: webhook ${id} not found`);
      },
    },
  };
}

function seedOrder(
  db: MemDb,
  overrides: Partial<LifecycleOrderRow> = {},
): LifecycleOrderRow {
  const id = overrides.id ?? `ord_${db.orders.size + 1}`;
  const row: LifecycleOrderRow = {
    id,
    code: `INV-2026-${String(db.orders.size + 1).padStart(6, "0")}`,
    buyerId: "buyer1",
    sellerId: "seller1",
    status: "PENDING",
    paymentStatus: "PENDING",
    subtotalCents: 10000,
    shippingCents: 1500,
    feeCents: 0,
    totalCents: 11500,
    currency: "IDR",
    shippingAddress: { name: "Test", line1: "x" },
    notes: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  };
  db.orders.set(id, row);
  return row;
}

/* -------------------------------------------------------------------------- */
/* State machine table                                                        */
/* -------------------------------------------------------------------------- */

describe("OrderLifecycleService — state machine table", () => {
  it("allows idempotent same-state transitions", () => {
    expect(canTransition("PENDING", "PENDING")).toBe(true);
    expect(canTransition("PAID", "PAID")).toBe(true);
    expect(canTransition("COMPLETED", "COMPLETED")).toBe(true);
  });
  it("permits the canonical happy path", () => {
    expect(canTransition("PENDING", "PAID")).toBe(true);
    expect(canTransition("PAID", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
    expect(canTransition("SHIPPED", "COMPLETED")).toBe(true);
    expect(canTransition("DELIVERED", "COMPLETED")).toBe(true);
  });
  it("rejects skipping states", () => {
    expect(canTransition("PENDING", "SHIPPED")).toBe(false);
    expect(canTransition("PENDING", "DELIVERED")).toBe(false);
    expect(canTransition("PAID", "DELIVERED")).toBe(false);
    expect(canTransition("PAID", "COMPLETED")).toBe(false);
  });
  it("locks terminal states", () => {
    expect(canTransition("COMPLETED", "SHIPPED")).toBe(false);
    expect(canTransition("CANCELLED", "PAID")).toBe(false);
    expect(canTransition("REFUNDED", "PAID")).toBe(false);
  });
  it("exposes ALLOWED_TRANSITIONS frozen-shape contract", () => {
    expect(ALLOWED_TRANSITIONS.PENDING).toEqual(["PAID", "CANCELLED"]);
    expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* markPaid                                                                   */
/* -------------------------------------------------------------------------- */

describe("OrderLifecycleService.markPaid", () => {
  let db: MemDb;
  let svc: OrderLifecycleService;
  beforeEach(() => {
    db = { orders: new Map(), webhooks: new Map() };
    svc = new OrderLifecycleService({ db: makeStore(db) });
  });

  it("transitions PENDING → PAID and stamps paidAt", async () => {
    const o = seedOrder(db);
    const now = new Date("2026-02-01T10:00:00Z");
    const out = await svc.markPaid({
      orderId: o.id,
      provider: "midtrans",
      externalId: "evt-1",
      payload: { x: 1 },
      now,
    });
    expect(out.status).toBe("PAID");
    expect(out.paymentStatus).toBe("PAID");
    expect(out.paidAt).toEqual(now);
  });

  it("is idempotent on duplicate webhook (same provider+externalId)", async () => {
    const o = seedOrder(db);
    const now = new Date("2026-02-01T10:00:00Z");
    await svc.markPaid({
      orderId: o.id,
      provider: "midtrans",
      externalId: "evt-1",
      payload: {},
      now,
    });
    // Second delivery: SHOULD be a no-op success returning current row.
    const again = await svc.markPaid({
      orderId: o.id,
      provider: "midtrans",
      externalId: "evt-1",
      payload: {},
      now: new Date("2026-02-01T10:05:00Z"),
    });
    expect(again.status).toBe("PAID");
    expect(again.paidAt).toEqual(now); // unchanged
  });

  it("rejects markPaid on a CANCELLED order", async () => {
    const o = seedOrder(db, { status: "CANCELLED" });
    await expect(
      svc.markPaid({
        orderId: o.id,
        provider: "midtrans",
        externalId: "evt-2",
        payload: {},
      }),
    ).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
      httpStatus: 409,
    });
  });

  it("returns 404 OrderLifecycleError when order missing", async () => {
    await expect(
      svc.markPaid({
        orderId: "nope",
        provider: "midtrans",
        externalId: "evt-3",
        payload: {},
      }),
    ).rejects.toBeInstanceOf(OrderLifecycleError);
  });

  it("treats fresh webhook on already-PAID order as no-op and marks processed", async () => {
    const o = seedOrder(db, {
      status: "PAID",
      paymentStatus: "PAID",
      paidAt: new Date("2026-01-15T00:00:00Z"),
    });
    const out = await svc.markPaid({
      orderId: o.id,
      provider: "midtrans",
      externalId: "evt-new",
      payload: {},
    });
    expect(out.status).toBe("PAID");
    expect(out.paidAt).toEqual(new Date("2026-01-15T00:00:00Z"));
  });
});

/* -------------------------------------------------------------------------- */
/* markShipped                                                                */
/* -------------------------------------------------------------------------- */

describe("OrderLifecycleService.markShipped", () => {
  let db: MemDb;
  let svc: OrderLifecycleService;
  beforeEach(() => {
    db = { orders: new Map(), webhooks: new Map() };
    svc = new OrderLifecycleService({ db: makeStore(db) });
  });

  it("transitions PAID → SHIPPED by the order's seller", async () => {
    const o = seedOrder(db, { status: "PAID", paymentStatus: "PAID" });
    const now = new Date("2026-02-02T08:00:00Z");
    const out = await svc.markShipped({
      orderId: o.id,
      actorSellerId: "seller1",
      now,
    });
    expect(out.status).toBe("SHIPPED");
    expect(out.shippedAt).toEqual(now);
  });

  it("forbids a different seller from shipping", async () => {
    const o = seedOrder(db, { status: "PAID", paymentStatus: "PAID" });
    await expect(
      svc.markShipped({ orderId: o.id, actorSellerId: "other" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_ACTOR", httpStatus: 403 });
  });

  it("rejects shipping a PENDING (unpaid) order", async () => {
    const o = seedOrder(db);
    await expect(
      svc.markShipped({ orderId: o.id, actorSellerId: "seller1" }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("is idempotent on an already-SHIPPED order", async () => {
    const shippedAt = new Date("2026-01-20T00:00:00Z");
    const o = seedOrder(db, {
      status: "SHIPPED",
      paymentStatus: "PAID",
      paidAt: new Date("2026-01-19T00:00:00Z"),
      shippedAt,
    });
    const out = await svc.markShipped({
      orderId: o.id,
      actorSellerId: "seller1",
      now: new Date("2026-01-21T00:00:00Z"),
    });
    expect(out.shippedAt).toEqual(shippedAt);
  });
});

/* -------------------------------------------------------------------------- */
/* confirmReceived                                                            */
/* -------------------------------------------------------------------------- */

describe("OrderLifecycleService.confirmReceived", () => {
  let db: MemDb;
  let svc: OrderLifecycleService;
  beforeEach(() => {
    db = { orders: new Map(), webhooks: new Map() };
    svc = new OrderLifecycleService({ db: makeStore(db) });
  });

  it("transitions SHIPPED → COMPLETED on buyer confirmation", async () => {
    const o = seedOrder(db, {
      status: "SHIPPED",
      paymentStatus: "PAID",
      paidAt: new Date("2026-01-19T00:00:00Z"),
      shippedAt: new Date("2026-01-20T00:00:00Z"),
    });
    const now = new Date("2026-01-22T00:00:00Z");
    const out = await svc.confirmReceived({
      orderId: o.id,
      actorBuyerId: "buyer1",
      now,
    });
    expect(out.status).toBe("COMPLETED");
    expect(out.completedAt).toEqual(now);
    expect(out.deliveredAt).toEqual(now);
  });

  it("forbids non-buyer from confirming", async () => {
    const o = seedOrder(db, {
      status: "SHIPPED",
      paymentStatus: "PAID",
      paidAt: new Date("2026-01-19T00:00:00Z"),
      shippedAt: new Date("2026-01-20T00:00:00Z"),
    });
    await expect(
      svc.confirmReceived({ orderId: o.id, actorBuyerId: "other" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN_ACTOR" });
  });

  it("rejects confirming a PENDING order", async () => {
    const o = seedOrder(db);
    await expect(
      svc.confirmReceived({ orderId: o.id, actorBuyerId: "buyer1" }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("is idempotent on already-COMPLETED orders", async () => {
    const completedAt = new Date("2026-01-22T00:00:00Z");
    const o = seedOrder(db, {
      status: "COMPLETED",
      paymentStatus: "PAID",
      paidAt: new Date("2026-01-19T00:00:00Z"),
      shippedAt: new Date("2026-01-20T00:00:00Z"),
      deliveredAt: completedAt,
      completedAt,
    });
    const out = await svc.confirmReceived({
      orderId: o.id,
      actorBuyerId: "buyer1",
      now: new Date("2026-01-23T00:00:00Z"),
    });
    expect(out.completedAt).toEqual(completedAt);
  });

  it("preserves an existing deliveredAt if already set", async () => {
    const delivered = new Date("2026-01-21T00:00:00Z");
    const o = seedOrder(db, {
      status: "DELIVERED",
      paymentStatus: "PAID",
      paidAt: new Date("2026-01-19T00:00:00Z"),
      shippedAt: new Date("2026-01-20T00:00:00Z"),
      deliveredAt: delivered,
    });
    const out = await svc.confirmReceived({
      orderId: o.id,
      actorBuyerId: "buyer1",
      now: new Date("2026-01-22T00:00:00Z"),
    });
    expect(out.status).toBe("COMPLETED");
    expect(out.deliveredAt).toEqual(delivered);
  });
});

/* -------------------------------------------------------------------------- */
/* autoCompleteShipped                                                        */
/* -------------------------------------------------------------------------- */

describe("OrderLifecycleService.autoCompleteShipped", () => {
  let db: MemDb;
  let svc: OrderLifecycleService;
  beforeEach(() => {
    db = { orders: new Map(), webhooks: new Map() };
    svc = new OrderLifecycleService({ db: makeStore(db) });
  });

  it("completes SHIPPED orders past the 7-day window", async () => {
    seedOrder(db, {
      id: "old",
      status: "SHIPPED",
      paymentStatus: "PAID",
      shippedAt: new Date("2026-01-01T00:00:00Z"),
    });
    seedOrder(db, {
      id: "fresh",
      status: "SHIPPED",
      paymentStatus: "PAID",
      shippedAt: new Date("2026-01-12T00:00:00Z"),
    });
    const now = new Date("2026-01-10T00:00:00Z"); // 9 days after "old", before "fresh"
    const result = await svc.autoCompleteShipped({ now });
    expect(result.completed).toEqual(["old"]);
    expect(result.scanned).toBe(1);
    const old = db.orders.get("old")!;
    expect(old.status).toBe("COMPLETED");
    expect(old.completedAt).toEqual(now);
  });

  it("does not touch SHIPPED orders inside the window", async () => {
    seedOrder(db, {
      id: "recent",
      status: "SHIPPED",
      paymentStatus: "PAID",
      shippedAt: new Date("2026-01-05T00:00:00Z"),
    });
    const now = new Date("2026-01-10T00:00:00Z"); // 5 days
    const result = await svc.autoCompleteShipped({ now });
    expect(result.completed).toEqual([]);
    expect(db.orders.get("recent")!.status).toBe("SHIPPED");
  });

  it("respects a custom windowDays parameter", async () => {
    seedOrder(db, {
      id: "x",
      status: "SHIPPED",
      paymentStatus: "PAID",
      shippedAt: new Date("2026-01-05T00:00:00Z"),
    });
    const now = new Date("2026-01-08T00:00:00Z"); // 3 days
    const result = await svc.autoCompleteShipped({ now, windowDays: 2 });
    expect(result.completed).toEqual(["x"]);
  });

  it("honors limit cap", async () => {
    for (let i = 0; i < 5; i++) {
      seedOrder(db, {
        id: `o${i}`,
        status: "SHIPPED",
        paymentStatus: "PAID",
        shippedAt: new Date("2026-01-01T00:00:00Z"),
      });
    }
    const now = new Date("2026-01-15T00:00:00Z");
    const result = await svc.autoCompleteShipped({ now, limit: 2 });
    expect(result.completed.length).toBe(2);
    expect(result.scanned).toBe(5);
  });

  it("rejects negative windowDays", async () => {
    await expect(
      svc.autoCompleteShipped({ windowDays: -1 }),
    ).rejects.toBeInstanceOf(OrderLifecycleError);
  });
});
