/**
 * CartService — MAS-33.
 *
 * Pre-checkout shopping cart. One cart per user (lazy-created on first
 * mutation). Cart items reference live products; stock/price/status are
 * NOT snapshotted here (snapshot happens at checkout).
 *
 * Rules:
 *   - Items added must be ACTIVE, not soft-deleted, stock ≥ requested qty.
 *   - Adding same product again increments quantity (clamped to stock).
 *   - Sellers may NOT add their own product (prevent self-trade).
 *   - Quantity must be ≥ 1, ≤ 1000 per line.
 *
 * Errors thrown as `CartError` with code + HTTP status.
 */

export interface CartRow {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItemRow {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CartProductLookup {
  id: string;
  sellerId: string;
  title: string;
  priceCents: number;
  currency: string;
  stock: number;
  weightGram: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  deletedAt: Date | null;
}

export interface CartStore {
  cart: {
    findUnique(args: { where: { userId: string } }): Promise<CartRow | null>;
    create(args: { data: { userId: string } }): Promise<CartRow>;
  };
  cartItem: {
    findMany(args: { where: { cartId: string } }): Promise<CartItemRow[]>;
    findUnique(args: { where: { id: string } }): Promise<CartItemRow | null>;
    findFirst(args: {
      where: { cartId: string; productId: string };
    }): Promise<CartItemRow | null>;
    create(args: {
      data: { cartId: string; productId: string; quantity: number };
    }): Promise<CartItemRow>;
    update(args: {
      where: { id: string };
      data: { quantity: number };
    }): Promise<CartItemRow>;
    delete(args: { where: { id: string } }): Promise<CartItemRow>;
    deleteMany(args: { where: { cartId: string } }): Promise<{ count: number }>;
  };
  product: {
    findUnique(args: { where: { id: string } }): Promise<CartProductLookup | null>;
  };
}

export type CartErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "PRODUCT_UNAVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "SELF_TRADE";

export class CartError extends Error {
  readonly code: CartErrorCode;
  readonly httpStatus: number;
  constructor(code: CartErrorCode, httpStatus: number, message: string) {
    super(message);
    this.name = "CartError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface CartView {
  id: string;
  userId: string;
  items: CartItemView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CartItemView {
  id: string;
  productId: string;
  sellerId: string;
  title: string;
  priceCents: number;
  currency: string;
  quantity: number;
  weightGram: number;
  subtotalCents: number;
  stock: number;
  available: boolean; // false if product deleted, archived, or stock<qty
}

const MAX_QTY_PER_LINE = 1000;

function validateQuantity(v: unknown): number {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new CartError("INVALID_INPUT", 400, "quantity must be an integer");
  }
  if (v < 1) throw new CartError("INVALID_INPUT", 400, "quantity must be ≥ 1");
  if (v > MAX_QTY_PER_LINE) {
    throw new CartError("INVALID_INPUT", 400, `quantity must be ≤ ${MAX_QTY_PER_LINE}`);
  }
  return v;
}

export interface CartServiceOptions {
  db: CartStore;
}

export class CartService {
  private readonly db: CartStore;

  constructor(opts: CartServiceOptions) {
    this.db = opts.db;
  }

  /** Get or create the cart row for a user (lazy creation). */
  private async ensureCart(userId: string): Promise<CartRow> {
    const existing = await this.db.cart.findUnique({ where: { userId } });
    if (existing) return existing;
    return this.db.cart.create({ data: { userId } });
  }

  async getCart(userId: string): Promise<CartView> {
    const cart = await this.ensureCart(userId);
    return this.buildView(cart);
  }

  private async buildView(cart: CartRow): Promise<CartView> {
    const items = await this.db.cartItem.findMany({ where: { cartId: cart.id } });
    const itemViews: CartItemView[] = [];
    for (const it of items) {
      const p = await this.db.product.findUnique({ where: { id: it.productId } });
      if (!p) {
        itemViews.push({
          id: it.id,
          productId: it.productId,
          sellerId: "",
          title: "(unavailable)",
          priceCents: 0,
          currency: "IDR",
          quantity: it.quantity,
          weightGram: 0,
          subtotalCents: 0,
          stock: 0,
          available: false,
        });
        continue;
      }
      const available =
        p.deletedAt === null && p.status === "ACTIVE" && p.stock >= it.quantity;
      itemViews.push({
        id: it.id,
        productId: it.productId,
        sellerId: p.sellerId,
        title: p.title,
        priceCents: p.priceCents,
        currency: p.currency,
        quantity: it.quantity,
        weightGram: p.weightGram,
        subtotalCents: p.priceCents * it.quantity,
        stock: p.stock,
        available,
      });
    }
    // Stable order: oldest item first.
    itemViews.sort((a, b) => a.id.localeCompare(b.id));
    return {
      id: cart.id,
      userId: cart.userId,
      items: itemViews,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  /**
   * Add a product to the cart. If the same product already exists, the
   * quantity is incremented (clamped to product stock).
   */
  async addItem(userId: string, productId: string, qty: unknown): Promise<CartView> {
    if (typeof productId !== "string" || productId.trim() === "") {
      throw new CartError("INVALID_INPUT", 400, "productId is required");
    }
    const quantity = validateQuantity(qty);
    const product = await this.db.product.findUnique({ where: { id: productId } });
    if (!product || product.deletedAt !== null) {
      throw new CartError("PRODUCT_UNAVAILABLE", 404, "product not found");
    }
    if (product.status !== "ACTIVE") {
      throw new CartError("PRODUCT_UNAVAILABLE", 409, "product is not active");
    }
    if (product.sellerId === userId) {
      throw new CartError("SELF_TRADE", 400, "cannot add own product to cart");
    }
    const cart = await this.ensureCart(userId);
    const existing = await this.db.cartItem.findFirst({
      where: { cartId: cart.id, productId },
    });
    const desired = (existing?.quantity ?? 0) + quantity;
    if (desired > product.stock) {
      throw new CartError(
        "INSUFFICIENT_STOCK",
        409,
        `requested ${desired} exceeds stock ${product.stock}`,
      );
    }
    if (desired > MAX_QTY_PER_LINE) {
      throw new CartError(
        "INVALID_INPUT",
        400,
        `total quantity per line must be ≤ ${MAX_QTY_PER_LINE}`,
      );
    }
    if (existing) {
      await this.db.cartItem.update({
        where: { id: existing.id },
        data: { quantity: desired },
      });
    } else {
      await this.db.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }
    return this.buildView(cart);
  }

  /** Set the absolute quantity of an existing cart item. */
  async updateItem(userId: string, itemId: string, qty: unknown): Promise<CartView> {
    const quantity = validateQuantity(qty);
    const item = await this.db.cartItem.findUnique({ where: { id: itemId } });
    if (!item) throw new CartError("NOT_FOUND", 404, "cart item not found");
    const cart = await this.ensureCart(userId);
    if (item.cartId !== cart.id) {
      throw new CartError("FORBIDDEN", 403, "cart item belongs to another user");
    }
    const product = await this.db.product.findUnique({ where: { id: item.productId } });
    if (!product || product.deletedAt !== null) {
      throw new CartError("PRODUCT_UNAVAILABLE", 404, "product not found");
    }
    if (quantity > product.stock) {
      throw new CartError(
        "INSUFFICIENT_STOCK",
        409,
        `requested ${quantity} exceeds stock ${product.stock}`,
      );
    }
    await this.db.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.buildView(cart);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const item = await this.db.cartItem.findUnique({ where: { id: itemId } });
    if (!item) throw new CartError("NOT_FOUND", 404, "cart item not found");
    const cart = await this.ensureCart(userId);
    if (item.cartId !== cart.id) {
      throw new CartError("FORBIDDEN", 403, "cart item belongs to another user");
    }
    await this.db.cartItem.delete({ where: { id: itemId } });
    return this.buildView(cart);
  }

  async clearCart(userId: string): Promise<CartView> {
    const cart = await this.ensureCart(userId);
    await this.db.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.buildView(cart);
  }
}
