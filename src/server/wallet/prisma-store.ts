/**
 * Prisma-backed adapter for `LedgerStore` — MAS-37.
 *
 * Binds the narrow `LedgerStore` contract to the live `PrismaClient`,
 * preserving:
 *  - Serialisable transactions for the post/transfer/reverse hot path.
 *  - BigInt amount/balance fidelity (no coercion through `number`).
 *  - The immutability invariant: this module only ever calls `create`
 *    on `prisma.ledgerEntry`, never `update` or `delete`. Account row
 *    balance updates ARE allowed because the balance field is the
 *    denormalised cache, not the audit trail.
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type {
  LedgerEntryRow,
  LedgerStore,
  WalletAccountRow,
} from "./ledger-service";
import type { WithdrawalStore } from "./withdrawal-service";

/* -------------------------------------------------------------------------- */
/* Row mappers                                                                */
/* -------------------------------------------------------------------------- */

function toAccountRow(a: {
  id: string;
  userId: string | null;
  type: WalletAccountRow["type"];
  currency: string;
  balanceCents: bigint;
}): WalletAccountRow {
  return {
    id: a.id,
    userId: a.userId,
    type: a.type,
    currency: a.currency,
    balanceCents: a.balanceCents,
  };
}

function toEntryRow(e: {
  id: string;
  accountId: string;
  direction: LedgerEntryRow["direction"];
  amountCents: bigint;
  currency: string;
  reason: LedgerEntryRow["reason"];
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
    direction: e.direction,
    amountCents: e.amountCents,
    currency: e.currency,
    reason: e.reason,
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

/* -------------------------------------------------------------------------- */
/* Builder                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Build a `LedgerStore` against `prisma`. The `tx` parameter is used
 * internally so the store can recurse into itself within a transaction —
 * callers should always pass the top-level client.
 */
export function buildLedgerStore(prisma: PrismaClient): LedgerStore {
  return bindStore(prisma);
}

type TxClient =
  | PrismaClient
  | Prisma.TransactionClient;

function bindStore(client: TxClient): LedgerStore {
  return {
    async transaction(fn) {
      // If we're already inside a tx (interactive Prisma tx exposes the
      // same interface), reuse it. The outer call always passes the
      // full PrismaClient, so this branch only fires for nested calls
      // (e.g. `transfer` -> inner `post`).
      const isPrismaClient =
        typeof (client as PrismaClient).$transaction === "function";
      if (!isPrismaClient) {
        return fn(bindStore(client));
      }
      return (client as PrismaClient).$transaction(
        async (tx) => fn(bindStore(tx)),
        {
          isolationLevel: "Serializable",
        },
      );
    },

    account: {
      async findUnique({ where }) {
        const a = await client.walletAccount.findUnique({ where });
        return a ? toAccountRow(a) : null;
      },
      async upsertByOwner({ userId, type, currency }) {
        // No composite unique on (userId, type, currency) yet — find-then-create.
        // Race protection: P2002 on the unique-when-added index falls back
        // to a re-read. Currently relies on application-level invariant.
        const existing = await client.walletAccount.findFirst({
          where: { userId, type, currency },
        });
        if (existing) return toAccountRow(existing);
        const created = await client.walletAccount.create({
          data: { userId, type, currency, balanceCents: BigInt(0) },
        });
        return toAccountRow(created);
      },
      async updateBalance({ where, balanceCents }) {
        const updated = await client.walletAccount.update({
          where,
          data: { balanceCents },
        });
        return toAccountRow(updated);
      },
    },

    entry: {
      async findUnique({ where }) {
        const e = await client.ledgerEntry.findUnique({ where });
        return e ? toEntryRow(e) : null;
      },
      async findByIdempotencyKey(key) {
        const e = await client.ledgerEntry.findUnique({
          where: { idempotencyKey: key },
        });
        return e ? toEntryRow(e) : null;
      },
      async findReversal(originalId) {
        const e = await client.ledgerEntry.findUnique({
          where: { reversesEntryId: originalId },
        });
        return e ? toEntryRow(e) : null;
      },
      async create({ data }) {
        const created = await client.ledgerEntry.create({
          data: {
            accountId: data.accountId,
            direction: data.direction,
            amountCents: data.amountCents,
            currency: data.currency,
            reason: data.reason,
            orderId: data.orderId,
            withdrawalId: data.withdrawalId,
            donationId: data.donationId,
            idempotencyKey: data.idempotencyKey,
            balanceAfterCents: data.balanceAfterCents,
            reversesEntryId: data.reversesEntryId,
            meta:
              data.meta == null
                ? Prisma.JsonNull
                : (data.meta as Prisma.InputJsonValue),
            ...(data.createdAt ? { createdAt: data.createdAt } : {}),
          },
        });
        return toEntryRow(created);
      },
      async listByAccount({ accountId, limit = 50, cursor = null }) {
        const rows = await client.ledgerEntry.findMany({
          where: { accountId },
          orderBy: { createdAt: "desc" },
          take: limit,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        return rows.map(toEntryRow);
      },
      async sumForAccount(accountId) {
        // Sum CREDITs and DEBITs separately, subtract — keeps each
        // aggregate inside bigint range without intermediate negation.
        const [credit, debit] = await Promise.all([
          client.ledgerEntry.aggregate({
            where: { accountId, direction: "CREDIT" },
            _sum: { amountCents: true },
          }),
          client.ledgerEntry.aggregate({
            where: { accountId, direction: "DEBIT" },
            _sum: { amountCents: true },
          }),
        ]);
        const c = credit._sum.amountCents ?? BigInt(0);
        const d = debit._sum.amountCents ?? BigInt(0);
        return c - d;
      },
    },
  };
}

export function buildWithdrawalStore(prisma: PrismaClient): WithdrawalStore {
  return {
    async create(args) {
      return prisma.withdrawal.create({
        data: {
          userId: args.userId,
          amountCents: args.amountCents,
          currency: args.currency,
          bankName: args.bankName,
          bankAccountNo: args.bankAccountNo,
          bankAccountName: args.bankAccountName,
          notes: args.notes,
        },
      });
    },
    async findUnique({ where }) {
      return prisma.withdrawal.findUnique({ where });
    },
    async update({ where, data }) {
      return prisma.withdrawal.update({ where, data });
    },
    async listByUser({ userId, limit = 20 }) {
      return prisma.withdrawal.findMany({
        where: { userId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    },
    async listAll({ status, limit = 20, offset = 0 }) {
      return prisma.withdrawal.findMany({
        where: status ? { status } : undefined,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });
    },
  };
}
