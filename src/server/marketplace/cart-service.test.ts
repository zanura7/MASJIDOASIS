import { describe, it, expect, beforeEach } from "vitest";

import {
  CartService,
  CartError,
  type CartStore,
  type CartRow,
  type CartItemRow,
  type CartProductLookup,
} from "./cart-service";

interface MemDb {
  carts: Map<string, CartRow>;
  itemsByCart: Map<string, CartItemRow[]>;
  products: Map<string, CartProductLookup>;
}

function makeStore(db: MemDb): CartStore {
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
          const found = items.find((i) => i.id === where.id);
          if (found) return found;
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
            const updated: CartItemRow = {
              ...items[idx]!,
              quantity: data.quantity,
              updatedAt: new Date(),
            };
            items[idx] = updated;
            return updated;
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
    },
  };
}

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
  products.set("p1", mk("p1", "seller-a"));
  products.set("p2", mk("p2", "seller-b", { priceCents: 80_000, weightGram: 250 }));
  products.set("p-out", mk("p-out", "seller-a", { stock: 0 }));
  products.set("p-draft", mk("p-draft", "seller-a", { status: "DRAFT" }));
  products.set("p-deleted", mk("p-deleted", "seller-a", { deletedAt: new Date() }));
  return {
    carts: new Map(),
    itemsByCart: new Map(),
    products,
  };
}

describe("CartService", () => {
  let db: MemDb;
  let svc: CartService;

  beforeEach(() => {
    db = freshDb();
    svc = new CartService({ db: makeStore(db) });
  });

  it("getCart lazily creates empty cart", async () => {
    const cart = await svc.getCart("buyer-1");
    expect(cart.userId).toBe("buyer-1");
    expect(cart.items).toEqual([]);
  });

  it("addItem inserts an enriched line", async () => {
    const cart = await svc.addItem("buyer-1", "p1", 2);
    expect(cart.items).toHaveLength(1);
    const it = cart.items[0]!;
    expect(it.productId).toBe("p1");
    expect(it.sellerId).toBe("seller-a");
    expect(it.quantity).toBe(2);
    expect(it.subtotalCents).toBe(100_000 * 2);
    expect(it.available).toBe(true);
  });

  it("addItem increments quantity on duplicate", async () => {
    await svc.addItem("buyer-1", "p1", 2);
    const cart = await svc.addItem("buyer-1", "p1", 3);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]!.quantity).toBe(5);
  });

  it("addItem rejects non-integer quantity", async () => {
    await expect(svc.addItem("buyer-1", "p1", 1.5)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("addItem rejects quantity < 1", async () => {
    await expect(svc.addItem("buyer-1", "p1", 0)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("addItem rejects quantity > 1000", async () => {
    await expect(svc.addItem("buyer-1", "p1", 1001)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("addItem rejects empty productId", async () => {
    await expect(svc.addItem("buyer-1", "", 1)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("addItem rejects unknown product", async () => {
    await expect(svc.addItem("buyer-1", "missing", 1)).rejects.toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
    });
  });

  it("addItem rejects soft-deleted product", async () => {
    await expect(svc.addItem("buyer-1", "p-deleted", 1)).rejects.toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
    });
  });

  it("addItem rejects DRAFT product", async () => {
    await expect(svc.addItem("buyer-1", "p-draft", 1)).rejects.toMatchObject({
      code: "PRODUCT_UNAVAILABLE",
    });
  });

  it("addItem rejects out-of-stock product", async () => {
    await expect(svc.addItem("buyer-1", "p-out", 1)).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
  });

  it("addItem rejects self-trade (seller adds own product)", async () => {
    await expect(svc.addItem("seller-a", "p1", 1)).rejects.toMatchObject({
      code: "SELF_TRADE",
    });
  });

  it("addItem rejects exceeding stock when incrementing", async () => {
    await svc.addItem("buyer-1", "p1", 9);
    await expect(svc.addItem("buyer-1", "p1", 2)).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
  });

  it("updateItem sets absolute quantity", async () => {
    const initial = await svc.addItem("buyer-1", "p1", 2);
    const itemId = initial.items[0]!.id;
    const updated = await svc.updateItem("buyer-1", itemId, 4);
    expect(updated.items[0]!.quantity).toBe(4);
  });

  it("updateItem refuses to mutate another user's item", async () => {
    const initial = await svc.addItem("buyer-1", "p1", 2);
    const itemId = initial.items[0]!.id;
    await expect(svc.updateItem("buyer-2", itemId, 1)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("updateItem rejects exceeding stock", async () => {
    const initial = await svc.addItem("buyer-1", "p1", 2);
    const itemId = initial.items[0]!.id;
    await expect(svc.updateItem("buyer-1", itemId, 99)).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
  });

  it("updateItem rejects unknown item", async () => {
    await expect(svc.updateItem("buyer-1", "missing", 1)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("removeItem deletes the line", async () => {
    const initial = await svc.addItem("buyer-1", "p1", 2);
    const itemId = initial.items[0]!.id;
    const after = await svc.removeItem("buyer-1", itemId);
    expect(after.items).toEqual([]);
  });

  it("removeItem refuses another user's item", async () => {
    const initial = await svc.addItem("buyer-1", "p1", 2);
    const itemId = initial.items[0]!.id;
    await expect(svc.removeItem("buyer-2", itemId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("clearCart empties everything", async () => {
    await svc.addItem("buyer-1", "p1", 2);
    await svc.addItem("buyer-1", "p2", 1);
    const after = await svc.clearCart("buyer-1");
    expect(after.items).toEqual([]);
  });

  it("CartError carries code + httpStatus", () => {
    const err = new CartError("INVALID_INPUT", 400, "bad");
    expect(err.code).toBe("INVALID_INPUT");
    expect(err.httpStatus).toBe(400);
  });
});
