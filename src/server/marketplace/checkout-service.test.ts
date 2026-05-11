import { describe, it, expect, beforeEach } from "vitest";

import {
  CheckoutService,
  CheckoutError,
  type CheckoutStore,
  type OrderRow,
  type OrderItemRow,
} from "./checkout-service";
import type { CartRow, CartItemRow, CartProductLookup } from "./cart-service";
import type { ShippingAddress } from "./shipping-quoter";

interface OrderRecord extends OrderRow {
  items: OrderItemRow[];
}

interface MemDb {
  carts: Map<string, CartRow>;
  itemsByCart: Map<string, CartItemRow[]>;
  products: Map<string, CartProductLookup>;
  orders: OrderRecord[];
  stockDecrements: Array<{ productId: string; by: number }>;
}

function makeStore(db: MemDb): CheckoutStore {
  let seq = 0;
  const nextId = (p: string) => `${p}_${++seq}`;
  return {
    cart: {
      async findUnique({ where }) {
        return db.carts.get(where.userId) ?? null;
      },
      async create({ data }) {
        const row: CartRow = {
          id: nextId("cart"),
          userId: data.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        db.carts.set(data.userId, row);
        db.itemsByCart.set(row.id, []);
        return row;
      },
    },
    cartItem: {
      async findMany({ where }) {
        return (db.itemsByCart.get(where.cartId) ?? []).slice();
      },
      async findUnique({ where }) {
        for (const items of db.itemsByCart.values()) {
          const f = items.find((i) => i.id === where.id);
          if (f) return f;
        }
        return null;
      },
      async findFirst({ where }) {
        const items = db.itemsByCart.get(where.cartId) ?? [];
        return items.find((i) => i.productId === where.productId) ?? null;
      },
      async create({ data }) {
        const row: CartItemRow = {
          id: nextId("ci"),
          cartId: data.cartId,
          productId: data.productId,
          quantity: data.quantity,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const list = db.itemsByCart.get(data.cartId) ?? [];
        list.push(row);
        db.itemsByCart.set(data.cartId, list);
        return row;
      },
      async update({ where, data }) {
        for (const items of db.itemsByCart.values()) {
          const idx = items.findIndex((i) => i.id === where.id);
          if (idx >= 0) {
            const u: CartItemRow = {
              ...items[idx]!,
              quantity: data.quantity,
              updatedAt: new Date(),
            };
            items[idx] = u;
            return u;
          }
        }
        throw new Error("not found");
      },
      async delete({ where }) {
        for (const items of db.itemsByCart.values()) {
          const idx = items.findIndex((i) => i.id === where.id);
          if (idx >= 0) {
            const [removed] = items.splice(idx, 1) as [CartItemRow];
            return removed;
          }
        }
        throw new Error("not found");
      },
      async deleteMany({ where }) {
        const list = db.itemsByCart.get(where.cartId) ?? [];
        const count = list.length;
        db.itemsByCart.set(where.cartId, []);
        return { count };
      },
    },
    product: {
      async findUnique({ where }) {
        return db.products.get(where.id) ?? null;
      },
      async updateStock({ where, decrement }) {
        const p = db.products.get(where.id);
        if (!p) throw new Error("missing");
        db.products.set(where.id, { ...p, stock: p.stock - decrement });
        db.stockDecrements.push({ productId: where.id, by: decrement });
      },
    },
    order: {
      async create({ data }) {
        const row: OrderRecord = {
          id: nextId("ord"),
          code: data.code,
          buyerId: data.buyerId,
          sellerId: data.sellerId,
          status: "PENDING",
          paymentStatus: "PENDING",
          subtotalCents: data.subtotalCents,
          shippingCents: data.shippingCents,
          feeCents: data.feeCents,
          totalCents: data.totalCents,
          currency: data.currency,
          shippingAddress: data.shippingAddress,
          notes: data.notes,
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        db.orders.push(row);
        return row;
      },
      async count({ where }) {
        return db.orders.filter((o) => o.code.startsWith(where.code.startsWith)).length;
      },
    },
    orderItem: {
      async create({ data }) {
        const row: OrderItemRow = {
          id: nextId("oi"),
          orderId: data.orderId,
          productId: data.productId,
          titleSnapshot: data.titleSnapshot,
          priceCents: data.priceCents,
          quantity: data.quantity,
          subtotalCents: data.subtotalCents,
        };
        const order = db.orders.find((o) => o.id === data.orderId);
        if (order) order.items.push(row);
        return row;
      },
    },
  };
}

const dest: ShippingAddress = {
  recipientName: "Buyer",
  phone: "08123456789",
  line1: "Jl Test 1",
  city: "Bandung",
  province: "Jawa Barat",
  postalCode: "40123",
  country: "ID",
};

function freshDb(): MemDb {
  const products = new Map<string, CartProductLookup>();
  const mk = (
    id: string,
    sellerId: string,
    overrides: Partial<CartProductLookup> = {},
  ): CartProductLookup => ({
    id,
    sellerId,
    title: id,
    priceCents: 100_000,
    currency: "IDR",
    stock: 10,
    weightGram: 500,
    status: "ACTIVE",
    deletedAt: null,
    ...overrides,
  });
  products.set("p1", mk("p1", "seller-a", { priceCents: 150_000, weightGram: 500 }));
  products.set("p2", mk("p2", "seller-a", { priceCents: 50_000, weightGram: 300 }));
  products.set("p3", mk("p3", "seller-b", { priceCents: 80_000, weightGram: 250 }));
  products.set("p-low", mk("p-low", "seller-a", { stock: 1 }));
  products.set("p-archived", mk("p-archived", "seller-a", { status: "ARCHIVED" }));
  return {
    carts: new Map(),
    itemsByCart: new Map(),
    products,
    orders: [],
    stockDecrements: [],
  };
}

function seed(db: MemDb, userId: string, items: Array<[string, number]>): void {
  const cart: CartRow = {
    id: `cart_${userId}`,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  db.carts.set(userId, cart);
  const list: CartItemRow[] = items.map(([pid, q], i) => ({
    id: `ci_${userId}_${i}`,
    cartId: cart.id,
    productId: pid,
    quantity: q,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  db.itemsByCart.set(cart.id, list);
}

function makeSvc(db: MemDb): CheckoutService {
  return new CheckoutService({
    db: makeStore(db),
    now: () => new Date(Date.UTC(2026, 0, 1)),
  });
}

describe("CheckoutService.quote", () => {
  let db: MemDb;
  let svc: CheckoutService;

  beforeEach(() => {
    db = freshDb();
    svc = makeSvc(db);
  });

  it("rejects when cart row doesn't exist (never used cart)", async () => {
    await expect(
      svc.quote("buyer-1", { service: "REG", destination: dest }),
    ).rejects.toMatchObject({ code: "EMPTY_CART" });
  });

  it("rejects when cart is empty", async () => {
    seed(db, "buyer-1", []);
    await expect(
      svc.quote("buyer-1", { service: "REG", destination: dest }),
    ).rejects.toMatchObject({ code: "EMPTY_CART" });
  });

  it("groups items by seller and computes totals", async () => {
    seed(db, "buyer-1", [["p1", 2], ["p2", 1], ["p3", 3]]);
    const q = await svc.quote("buyer-1", { service: "REG", destination: dest });
    expect(q.groups).toHaveLength(2);
    const a = q.groups.find((g) => g.sellerId === "seller-a")!;
    const b = q.groups.find((g) => g.sellerId === "seller-b")!;
    expect(a.subtotalCents).toBe(150_000 * 2 + 50_000);
    expect(b.subtotalCents).toBe(80_000 * 3);
    expect(q.grandTotalCents).toBe(
      q.itemsSubtotalCents + q.shippingTotalCents,
    );
  });

  it("rejects insufficient stock", async () => {
    seed(db, "buyer-1", [["p-low", 5]]);
    await expect(
      svc.quote("buyer-1", { service: "REG", destination: dest }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("rejects archived product", async () => {
    seed(db, "buyer-1", [["p-archived", 1]]);
    await expect(
      svc.quote("buyer-1", { service: "REG", destination: dest }),
    ).rejects.toMatchObject({ code: "PRODUCT_UNAVAILABLE" });
  });

  it("rejects self-trade", async () => {
    seed(db, "seller-a", [["p1", 1]]);
    await expect(
      svc.quote("seller-a", { service: "REG", destination: dest }),
    ).rejects.toMatchObject({ code: "SELF_TRADE" });
  });

  it("rejects bad address", async () => {
    seed(db, "buyer-1", [["p1", 1]]);
    await expect(
      svc.quote("buyer-1", {
        service: "REG",
        destination: { ...dest, postalCode: "" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("CheckoutService.createOrders", () => {
  let db: MemDb;
  let svc: CheckoutService;

  beforeEach(() => {
    db = freshDb();
    svc = makeSvc(db);
  });

  it("creates one order per seller, decrements stock, clears cart", async () => {
    seed(db, "buyer-1", [["p1", 2], ["p3", 1]]);
    const res = await svc.createOrders("buyer-1", {
      service: "REG",
      destination: dest,
    });
    expect(res.orders).toHaveLength(2);

    // Stock decremented:
    expect(db.stockDecrements).toEqual(
      expect.arrayContaining([
        { productId: "p1", by: 2 },
        { productId: "p3", by: 1 },
      ]),
    );

    // Cart cleared:
    const cart = db.carts.get("buyer-1")!;
    expect(db.itemsByCart.get(cart.id)).toEqual([]);

    // Order codes shape:
    res.orders.forEach((o) => expect(o.code).toMatch(/^INV-2026-\d{6}$/));

    // Order items snapshotted:
    const o1 = res.orders.find((o) => o.sellerId === "seller-a")!;
    expect(o1.items).toEqual([
      expect.objectContaining({ productId: "p1", quantity: 2, priceCents: 150_000 }),
    ]);
  });

  it("rejects empty cart at commit time", async () => {
    seed(db, "buyer-1", []);
    await expect(
      svc.createOrders("buyer-1", { service: "REG", destination: dest }),
    ).rejects.toMatchObject({ code: "EMPTY_CART" });
  });

  it("rejects insufficient stock at commit time", async () => {
    seed(db, "buyer-1", [["p-low", 5]]);
    await expect(
      svc.createOrders("buyer-1", { service: "REG", destination: dest }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("rejects notes > 2000 chars", async () => {
    seed(db, "buyer-1", [["p1", 1]]);
    await expect(
      svc.createOrders("buyer-1", {
        service: "REG",
        destination: dest,
        notes: "x".repeat(2001),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("CheckoutError carries code + status", () => {
    const e = new CheckoutError("EMPTY_CART", 400, "x");
    expect(e.code).toBe("EMPTY_CART");
    expect(e.httpStatus).toBe(400);
  });
});
