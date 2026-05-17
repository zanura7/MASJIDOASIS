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
import type {
  LedgerEntryRow,
  LedgerStore,
  WalletAccountRow,
} from "@/server/wallet/ledger-service";

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


/* -------------------------------------------------------------------------- */
/* LedgerStore (MAS-37 / MAS-38)                                              */
/* -------------------------------------------------------------------------- */

function toWalletAccountRow(a: {
  id: string;
  userId: string | null;
  type: string;
  currency: string;
  balanceCents: bigint;
}): WalletAccountRow {
  return {
    id: a.id,
    userId: a.userId,
    type: a.type as WalletAccountRow["type"],
    currency: a.currency,
    balanceCents: a.balanceCents,
  };
}

function toLedgerEntryRow(e: {
  id: string;
  accountId: string;
  direction: string;
  amountCents: bigint;
  currency: string;
  reason: string;
  orderId: string | null;
  withdrawalId: string | null;
  donationId: string | null;
  idempotencyKey: string | null;
  balanceAfterCents: bigint;
  reversesEntryId: string | null;
  meta: unknown;
  createdAt: Date;
}): LedgerEntryRow {
  return {
    id: e.id,
    accountId: e.accountId,
    direction: e.direction as LedgerEntryRow["direction"],
    amountCents: e.amountCents,
    currency: e.currency,
    reason: e.reason as LedgerEntryRow["reason"],
    orderId: e.orderId,
    withdrawalId: e.withdrawalId,
    donationId: e.donationId,
    idempotencyKey: e.idempotencyKey,
    balanceAfterCents: e.balanceAfterCents,
    reversesEntryId: e.reversesEntryId,
    meta: e.meta,
    createdAt: e.createdAt,
  };
}

/**
 * Build a Prisma-backed `LedgerStore` for `LedgerService`.
 *
 * The `transaction()` method maps to `prisma.$transaction(async (tx) => ...)`
 * with the tx client wrapped in another `buildLedgerStoreFromPrisma` call so
 * nested operations stay atomic.
 */
export function buildLedgerStoreFromPrisma(
  prisma: PrismaClient,
): LedgerStore {
  const client = prisma as PrismaClient;
  return {
    async transaction<T>(fn: (tx: LedgerStore) => Promise<T>): Promise<T> {
      return client.$transaction(async (tx) => {
        // `tx` is a Prisma.TransactionClient — shape-compatible with
        // PrismaClient for the operations we use, but typed narrower.
        // Cast at the boundary is safe and isolated.
        return fn(buildLedgerStoreFromPrisma(tx as unknown as PrismaClient));
      });
    },
    account: {
      async findUnique({ where }) {
        const a = await client.walletAccount.findUnique({ where });
        return a ? toWalletAccountRow(a) : null;
      },
      async upsertByOwner({ userId, type, currency }) {
        const cur = currency ?? "IDR";
        const existing = await client.walletAccount.findUnique({
          where: {
            userId_type_currency: { userId: (userId ?? "") as string, type: type as never, currency: cur },
          },
        });
        if (existing) return toWalletAccountRow(existing);
        const created = await client.walletAccount.create({
          data: {
            userId: userId ?? null,
            type: type as never,
            currency: cur,
            balanceCents: BigInt(0),
          },
        });
        return toWalletAccountRow(created);
      },
      async updateBalance({ where, balanceCents }) {
        const updated = await client.walletAccount.update({
          where,
          data: { balanceCents },
        });
        return toWalletAccountRow(updated);
      },
    },
    entry: {
      async findUnique({ where }) {
        const e = await client.ledgerEntry.findUnique({ where });
        return e ? toLedgerEntryRow(e) : null;
      },
      async findByIdempotencyKey(key) {
        const e = await client.ledgerEntry.findUnique({
          where: { idempotencyKey: key },
        });
        return e ? toLedgerEntryRow(e) : null;
      },
      async findReversal(originalId) {
        const e = await client.ledgerEntry.findUnique({
          where: { reversesEntryId: originalId },
        });
        return e ? toLedgerEntryRow(e) : null;
      },
      async create({ data }) {
        const created = await client.ledgerEntry.create({
          data: {
            accountId: data.accountId,
            direction: data.direction as never,
            amountCents: data.amountCents,
            currency: data.currency,
            reason: data.reason as never,
            orderId: data.orderId,
            withdrawalId: data.withdrawalId,
            donationId: data.donationId,
            idempotencyKey: data.idempotencyKey,
            balanceAfterCents: data.balanceAfterCents,
            reversesEntryId: data.reversesEntryId,
            meta:
              data.meta == null
                ? undefined
                : (data.meta as object),
            ...(data.createdAt ? { createdAt: data.createdAt } : {}),
          },
        });
        return toLedgerEntryRow(created);
      },
      async listByAccount({ accountId, limit, cursor }) {
        const rows = await client.ledgerEntry.findMany({
          where: { accountId },
          orderBy: { createdAt: "asc" },
          take: limit ?? 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        return rows.map(toLedgerEntryRow);
      },
      async sumForAccount(accountId) {
        const rows = await client.ledgerEntry.findMany({
          where: { accountId },
          select: { direction: true, amountCents: true },
        });
        let net = BigInt(0);
        for (const r of rows) {
          if (r.direction === "CREDIT") net += r.amountCents;
          else net -= r.amountCents;
        }
        return net;
      },
    },
  };
}
