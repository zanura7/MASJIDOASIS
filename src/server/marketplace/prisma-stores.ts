/**
 * Prisma-backed store adapters for CartService and CheckoutService.
 *
 * The service interfaces deliberately accept narrow stores (instead of
 * the whole PrismaClient) so they can be unit-tested with in-memory
 * implementations. These adapters bind the narrow shape to the live
 * Prisma client.
 *
 * MAS-33.
 */

import type { PrismaClient } from "@prisma/client";
import type {
  CartItemRow,
  CartProductLookup,
  CartRow,
  CartStore,
} from "./cart-service";
import type {
  CheckoutOrderStore,
  CheckoutStore,
  OrderItemRow,
  OrderRow,
} from "./checkout-service";

function toProductLookup(p: {
  id: string;
  sellerId: string;
  title: string;
  priceCents: number;
  currency: string;
  stock: number;
  weightGram: number;
  status: string;
  deletedAt: Date | null;
}): CartProductLookup {
  return {
    id: p.id,
    sellerId: p.sellerId,
    title: p.title,
    priceCents: p.priceCents,
    currency: p.currency,
    stock: p.stock,
    weightGram: p.weightGram,
    status: p.status as CartProductLookup["status"],
    deletedAt: p.deletedAt,
  };
}

export function buildCartStore(prisma: PrismaClient): CartStore {
  return {
    cart: {
      async findUnique({ where }): Promise<CartRow | null> {
        return prisma.cart.findUnique({ where });
      },
      async create({ data }): Promise<CartRow> {
        return prisma.cart.create({ data });
      },
    },
    cartItem: {
      async findMany({ where }): Promise<CartItemRow[]> {
        return prisma.cartItem.findMany({ where });
      },
      async findUnique({ where }): Promise<CartItemRow | null> {
        return prisma.cartItem.findUnique({ where });
      },
      async findFirst({ where }): Promise<CartItemRow | null> {
        return prisma.cartItem.findFirst({ where });
      },
      async create({ data }): Promise<CartItemRow> {
        return prisma.cartItem.create({ data });
      },
      async update({ where, data }): Promise<CartItemRow> {
        return prisma.cartItem.update({ where, data });
      },
      async delete({ where }): Promise<CartItemRow> {
        return prisma.cartItem.delete({ where });
      },
      async deleteMany({ where }): Promise<{ count: number }> {
        return prisma.cartItem.deleteMany({ where });
      },
    },
    product: {
      async findUnique({ where }): Promise<CartProductLookup | null> {
        const p = await prisma.product.findUnique({
          where,
          select: {
            id: true,
            sellerId: true,
            title: true,
            priceCents: true,
            currency: true,
            stock: true,
            weightGram: true,
            status: true,
            deletedAt: true,
          },
        });
        return p ? toProductLookup(p) : null;
      },
    },
  };
}

function buildCheckoutOrderStore(prisma: PrismaClient): CheckoutOrderStore {
  return {
    order: {
      async create({ data }): Promise<OrderRow> {
        const o = await prisma.order.create({
          data: {
            code: data.code,
            buyerId: data.buyerId,
            sellerId: data.sellerId,
            subtotalCents: data.subtotalCents,
            shippingCents: data.shippingCents,
            feeCents: data.feeCents,
            totalCents: data.totalCents,
            currency: data.currency,
            shippingAddress: data.shippingAddress as object,
            notes: data.notes,
          },
        });
        return {
          id: o.id,
          code: o.code,
          buyerId: o.buyerId,
          sellerId: o.sellerId,
          status: o.status,
          paymentStatus: o.paymentStatus,
          subtotalCents: o.subtotalCents,
          shippingCents: o.shippingCents,
          feeCents: o.feeCents,
          totalCents: o.totalCents,
          currency: o.currency,
          shippingAddress: o.shippingAddress,
          notes: o.notes,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        };
      },
      async count({ where }): Promise<number> {
        return prisma.order.count({ where: { code: where.code } });
      },
    },
    orderItem: {
      async create({ data }): Promise<OrderItemRow> {
        const oi = await prisma.orderItem.create({ data });
        return {
          id: oi.id,
          orderId: oi.orderId,
          productId: oi.productId,
          titleSnapshot: oi.titleSnapshot,
          priceCents: oi.priceCents,
          quantity: oi.quantity,
          subtotalCents: oi.subtotalCents,
        };
      },
    },
    product: {
      async updateStock({ where, decrement }): Promise<void> {
        await prisma.product.update({
          where: { id: where.id },
          data: { stock: { decrement } },
        });
      },
    },
  };
}

export function buildCheckoutStore(prisma: PrismaClient): CheckoutStore {
  const cart = buildCartStore(prisma);
  const order = buildCheckoutOrderStore(prisma);
  return {
    cart: cart.cart,
    cartItem: cart.cartItem,
    order: order.order,
    orderItem: order.orderItem,
    product: { ...cart.product, ...order.product },
  };
}
