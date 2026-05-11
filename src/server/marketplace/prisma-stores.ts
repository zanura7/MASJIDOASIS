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
import type {
  LifecycleOrderRow,
  OrderLifecycleStore,
} from "./order-lifecycle-service";

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

/* -------------------------------------------------------------------------- */
/* OrderLifecycleStore (MAS-34)                                               */
/* -------------------------------------------------------------------------- */

function toLifecycleRow(o: {
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
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
}): LifecycleOrderRow {
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
    paidAt: o.paidAt,
    shippedAt: o.shippedAt,
    deliveredAt: o.deliveredAt,
    completedAt: o.completedAt,
    cancelledAt: o.cancelledAt,
  };
}

export function buildOrderLifecycleStore(
  prisma: PrismaClient,
): OrderLifecycleStore {
  return {
    order: {
      async findUnique({ where }) {
        const o = await prisma.order.findUnique({ where });
        return o ? toLifecycleRow(o) : null;
      },
      async update({ where, data }) {
        // Map our string-typed status to Prisma's enum at the boundary.
        // Prisma accepts the bare enum string at runtime; we coerce via
        // `as never` because the enum types live in `@prisma/client`
        // and re-importing here would couple the public store contract
        // to Prisma. Boundary cast is intentional and isolated.
        const updated = await prisma.order.update({
          where,
          data: data as never,
        });
        return toLifecycleRow(updated);
      },
      async findManyEligibleForAutoComplete({ shippedBefore }) {
        const rows = await prisma.order.findMany({
          where: {
            status: "SHIPPED",
            shippedAt: { lt: shippedBefore, not: null },
          },
          orderBy: { shippedAt: "asc" },
        });
        return rows.map(toLifecycleRow);
      },
    },
    webhookEvent: {
      async claim({ provider, externalId, payload, signature }) {
        // Try to load existing row first.
        const existing = await prisma.webhookEvent.findUnique({
          where: {
            provider_externalId: { provider, externalId },
          },
        });
        if (existing) {
          if (existing.processedAt) return { alreadyProcessed: true };
          return { alreadyProcessed: false, id: existing.id };
        }
        // Race-safe create: if a parallel call also inserted, Prisma
        // throws P2002 unique violation — translate to "fetch then
        // re-evaluate processed flag".
        try {
          const created = await prisma.webhookEvent.create({
            data: {
              provider,
              externalId,
              payload: payload as object,
              signature: signature ?? null,
            },
          });
          return { alreadyProcessed: false, id: created.id };
        } catch (e: unknown) {
          if (
            typeof e === "object" &&
            e !== null &&
            "code" in e &&
            (e as { code?: string }).code === "P2002"
          ) {
            const row = await prisma.webhookEvent.findUnique({
              where: { provider_externalId: { provider, externalId } },
            });
            if (!row) throw e;
            if (row.processedAt) return { alreadyProcessed: true };
            return { alreadyProcessed: false, id: row.id };
          }
          throw e;
        }
      },
      async markProcessed({ id, at }) {
        await prisma.webhookEvent.update({
          where: { id },
          data: { processedAt: at },
        });
      },
    },
  };
}
