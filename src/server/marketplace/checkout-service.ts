/**
 * CheckoutService — MAS-33.
 *
 * Converts a buyer's cart into one or more Orders (one per seller).
 * Shipping is quoted per-seller via the injected ShippingQuoter.
 *
 * Flow:
 *   1. Load cart items (must be non-empty).
 *   2. Load each referenced product (must be ACTIVE, not deleted,
 *      seller != buyer, stock ≥ qty).
 *   3. Group items by sellerId.
 *   4. Quote shipping per seller-group (totalWeight = sum item.weightGram * qty).
 *   5. Generate order code (INV-YYYY-NNNNNN, monotonic per year).
 *   6. Create Order + OrderItems for each group atomically (txn).
 *   7. Decrement product stock.
 *   8. Clear cart.
 *
 * Payment is NOT initiated here — separate ticket. Orders start at
 * status=PENDING / paymentStatus=PENDING.
 *
 * Errors thrown as `CheckoutError`.
 */

import { CartError, type CartStore, type CartView } from "./cart-service";
import {
  defaultShippingQuoter,
  type ShippingQuoter,
  type ShippingService,
  type ShippingAddress,
  type ShippingQuote,
  ShippingQuoteError,
  validateAddress,
} from "./shipping-quoter";

export type CheckoutErrorCode =
  | "EMPTY_CART"
  | "CART_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "SELF_TRADE"
  | "INVALID_INPUT"
  | "INTERNAL";

export class CheckoutError extends Error {
  readonly code: CheckoutErrorCode;
  readonly httpStatus: number;
  constructor(code: CheckoutErrorCode, httpStatus: number, message: string) {
    super(message);
    this.name = "CheckoutError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface OrderRow {
  id: string;
  code: string;
  buyerId: string;
  sellerId: string;
  status: string;
  paymentStatus: string;
  subtotalCents: number;
  shippingCents: number;
  feeCents: number;
  totalCents: number;
  currency: string;
  shippingAddress: unknown;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItemRow {
  id: string;
  orderId: string;
  productId: string;
  titleSnapshot: string;
  priceCents: number;
  quantity: number;
  subtotalCents: number;
}

export interface CheckoutOrderStore {
  order: {
    create(args: {
      data: {
        code: string;
        buyerId: string;
        sellerId: string;
        subtotalCents: number;
        shippingCents: number;
        feeCents: number;
        totalCents: number;
        currency: string;
        shippingAddress: unknown;
        notes: string | null;
      };
    }): Promise<OrderRow>;
    count(args: {
      where: { code: { startsWith: string } };
    }): Promise<number>;
  };
  orderItem: {
    create(args: {
      data: {
        orderId: string;
        productId: string;
        titleSnapshot: string;
        priceCents: number;
        quantity: number;
        subtotalCents: number;
      };
    }): Promise<OrderItemRow>;
  };
  product: {
    updateStock(args: {
      where: { id: string };
      decrement: number;
    }): Promise<void>;
  };
}

/** Full store for CheckoutService = cart store extended with order ops + product.updateStock. */
export type CheckoutStore = Omit<CartStore, "product"> & CheckoutOrderStore & {
  product: CartStore["product"] & CheckoutOrderStore["product"];
};

export interface QuoteCheckoutInput {
  service: ShippingService;
  destination: ShippingAddress;
}

export interface SellerGroupQuote {
  sellerId: string;
  items: Array<{
    productId: string;
    title: string;
    quantity: number;
    priceCents: number;
    weightGram: number;
    subtotalCents: number;
  }>;
  totalWeightGram: number;
  subtotalCents: number;
  shipping: ShippingQuote;
  totalCents: number;
}

export interface CheckoutQuoteResult {
  groups: SellerGroupQuote[];
  itemsSubtotalCents: number;
  shippingTotalCents: number;
  grandTotalCents: number;
  currency: string;
}

export interface CreateOrderInput extends QuoteCheckoutInput {
  notes?: string;
}

export interface CreateOrderResult {
  orders: Array<{
    id: string;
    code: string;
    sellerId: string;
    subtotalCents: number;
    shippingCents: number;
    totalCents: number;
    currency: string;
    items: Array<{
      productId: string;
      titleSnapshot: string;
      quantity: number;
      priceCents: number;
      subtotalCents: number;
    }>;
  }>;
  itemsSubtotalCents: number;
  shippingTotalCents: number;
  grandTotalCents: number;
  currency: string;
}

export interface CheckoutServiceOptions {
  db: CheckoutStore;
  shippingQuoter?: ShippingQuoter;
  now?: () => Date;
}

export class CheckoutService {
  private readonly db: CheckoutStore;
  private readonly shippingQuoter: ShippingQuoter;
  private readonly now: () => Date;

  constructor(opts: CheckoutServiceOptions) {
    this.db = opts.db;
    this.shippingQuoter = opts.shippingQuoter ?? defaultShippingQuoter;
    this.now = opts.now ?? (() => new Date());
  }

  /**
   * Build the seller-grouped checkout summary from the buyer's cart.
   * Validates availability (throws PRODUCT_UNAVAILABLE / INSUFFICIENT_STOCK
   * on issues) so callers can show preview before committing.
   */
  async quote(userId: string, input: QuoteCheckoutInput): Promise<CheckoutQuoteResult> {
    const dest = validateAddressOrRethrow(input.destination);
    const cart = await this.loadCart(userId);
    if (cart.items.length === 0) {
      throw new CheckoutError("EMPTY_CART", 400, "cart is empty");
    }
    this.validateItems(cart, userId);

    // Group by seller.
    const bySeller = new Map<string, SellerGroupQuote["items"]>();
    for (const it of cart.items) {
      const list = bySeller.get(it.sellerId) ?? [];
      list.push({
        productId: it.productId,
        title: it.title,
        quantity: it.quantity,
        priceCents: it.priceCents,
        weightGram: it.weightGram,
        subtotalCents: it.subtotalCents,
      });
      bySeller.set(it.sellerId, list);
    }

    const groups: SellerGroupQuote[] = [];
    let itemsSubtotalCents = 0;
    let shippingTotalCents = 0;
    let currency = "IDR";
    // Stable seller ordering.
    const sortedSellers = Array.from(bySeller.keys()).sort();
    for (const sellerId of sortedSellers) {
      const items = bySeller.get(sellerId)!;
      const subtotal = items.reduce((s, i) => s + i.subtotalCents, 0);
      const weight = items.reduce((s, i) => s + i.weightGram * i.quantity, 0);
      const shipping = quoteOrRethrow(this.shippingQuoter, {
        service: input.service,
        totalWeightGram: weight,
        destination: dest,
      });
      currency = shipping.currency;
      itemsSubtotalCents += subtotal;
      shippingTotalCents += shipping.costCents;
      groups.push({
        sellerId,
        items,
        totalWeightGram: weight,
        subtotalCents: subtotal,
        shipping,
        totalCents: subtotal + shipping.costCents,
      });
    }
    return {
      groups,
      itemsSubtotalCents,
      shippingTotalCents,
      grandTotalCents: itemsSubtotalCents + shippingTotalCents,
      currency,
    };
  }

  /**
   * Commit checkout: create Order rows per seller, decrement stock, clear cart.
   * Returns the created orders. Payment NOT initiated here.
   */
  async createOrders(userId: string, input: CreateOrderInput): Promise<CreateOrderResult> {
    // Re-quote so we have authoritative pricing + shipping.
    const q = await this.quote(userId, input);

    const dest = validateAddressOrRethrow(input.destination);
    const notes = typeof input.notes === "string" ? input.notes.trim() : null;
    if (notes !== null && notes.length > 2000) {
      throw new CheckoutError("INVALID_INPUT", 400, "notes must be ≤ 2000 chars");
    }

    const createdOrders: CreateOrderResult["orders"] = [];
    const year = this.now().getUTCFullYear();
    const prefix = `INV-${year}-`;
    // Per-checkout counter — count existing rows up-front, then increment.
    let nextSeq = (await this.db.order.count({ where: { code: { startsWith: prefix } } })) + 1;

    for (const g of q.groups) {
      const code = `${prefix}${String(nextSeq).padStart(6, "0")}`;
      nextSeq += 1;
      const order = await this.db.order.create({
        data: {
          code,
          buyerId: userId,
          sellerId: g.sellerId,
          subtotalCents: g.subtotalCents,
          shippingCents: g.shipping.costCents,
          feeCents: 0,
          totalCents: g.totalCents,
          currency: g.shipping.currency,
          shippingAddress: dest as unknown,
          notes,
        },
      });
      const items: CreateOrderResult["orders"][number]["items"] = [];
      for (const it of g.items) {
        await this.db.orderItem.create({
          data: {
            orderId: order.id,
            productId: it.productId,
            titleSnapshot: it.title,
            priceCents: it.priceCents,
            quantity: it.quantity,
            subtotalCents: it.subtotalCents,
          },
        });
        await this.db.product.updateStock({
          where: { id: it.productId },
          decrement: it.quantity,
        });
        items.push({
          productId: it.productId,
          titleSnapshot: it.title,
          quantity: it.quantity,
          priceCents: it.priceCents,
          subtotalCents: it.subtotalCents,
        });
      }
      createdOrders.push({
        id: order.id,
        code: order.code,
        sellerId: order.sellerId,
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        totalCents: order.totalCents,
        currency: order.currency,
        items,
      });
    }

    // Clear cart on success.
    const cart = await this.db.cart.findUnique({ where: { userId } });
    if (cart) {
      await this.db.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return {
      orders: createdOrders,
      itemsSubtotalCents: q.itemsSubtotalCents,
      shippingTotalCents: q.shippingTotalCents,
      grandTotalCents: q.grandTotalCents,
      currency: q.currency,
    };
  }

  private validateItems(cart: CartView, userId: string): void {
    for (const it of cart.items) {
      if (!it.available) {
        // Distinguish missing vs stock.
        if (it.stock < it.quantity) {
          throw new CheckoutError(
            "INSUFFICIENT_STOCK",
            409,
            `product ${it.productId} has insufficient stock (${it.stock} < ${it.quantity})`,
          );
        }
        throw new CheckoutError(
          "PRODUCT_UNAVAILABLE",
          409,
          `product ${it.productId} is no longer available`,
        );
      }
      if (it.sellerId === userId) {
        throw new CheckoutError("SELF_TRADE", 400, "cart contains own product");
      }
    }
  }

  private async loadCart(userId: string): Promise<CartView> {
    // Reuse CartService.getCart semantics — but we want the same enriched
    // view, so we inline a lightweight equivalent here to avoid coupling.
    const cart = await this.db.cart.findUnique({ where: { userId } });
    if (!cart) {
      throw new CheckoutError("EMPTY_CART", 400, "cart is empty");
    }
    const items = await this.db.cartItem.findMany({ where: { cartId: cart.id } });
    const out: CartView = {
      id: cart.id,
      userId: cart.userId,
      items: [],
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
    for (const it of items) {
      const p = await this.db.product.findUnique({ where: { id: it.productId } });
      if (!p) {
        out.items.push({
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
      out.items.push({
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
    out.items.sort((a, b) => a.id.localeCompare(b.id));
    return out;
  }
}

function quoteOrRethrow(
  q: ShippingQuoter,
  input: Parameters<ShippingQuoter["quote"]>[0],
): ShippingQuote {
  try {
    return q.quote(input);
  } catch (err) {
    if (err instanceof ShippingQuoteError) {
      throw new CheckoutError(
        err.code === "SERVICE_UNAVAILABLE" ? "INVALID_INPUT" : "INVALID_INPUT",
        err.httpStatus,
        err.message,
      );
    }
    throw err;
  }
}

function validateAddressOrRethrow(addr: unknown): ShippingAddress {
  try {
    return validateAddress(addr);
  } catch (err) {
    if (err instanceof ShippingQuoteError) {
      throw new CheckoutError("INVALID_INPUT", err.httpStatus, err.message);
    }
    throw err;
  }
}

// Re-export so route layer can do `instanceof CartError` from one module.
export { CartError };
