/**
 * Wallet ledger service — MAS-37.
 *
 * Implements the **immutable, append-only** double-entry ledger that backs
 * every monetary movement in the platform (orders, payouts, donations,
 * adjustments). The contract is intentionally minimal so subsequent tickets
 * (MAS-38 escrow release, MAS-39 withdrawals, MAS-44 donations) can compose
 * higher-level flows on top.
 *
 * Design choices:
 *
 * 1. **Append-only.** Once written, a `LedgerEntry` row is never updated
 *    or deleted. There is no public `update` or `delete` operation on the
 *    service. The Prisma model has no `updatedAt` either. Mistakes are
 *    fixed by writing a *reversal* entry (`reverseEntry`) which points
 *    back to the original via `reversesEntryId`. The original entry is
 *    left intact — auditors must always be able to reconstruct the full
 *    history.
 *
 * 2. **balanceAfterCents is cached, not authoritative.** Every entry
 *    snapshots the account balance immediately after itself for fast
 *    statement reads. The authoritative balance is always
 *    `sum(amount * sign(direction))` over the entry stream — exposed via
 *    `recomputeBalance` for reconciliation jobs. `WalletAccount.balanceCents`
 *    is also kept in sync as a denormalised cache.
 *
 * 3. **Idempotency.** Any caller may pass an `idempotencyKey`. The DB
 *    has a unique index on `LedgerEntry.idempotencyKey`; a repeated post
 *    with the same key returns the existing entry instead of writing a
 *    duplicate. This is critical for payment webhooks and retried jobs.
 *
 * 4. **DI-friendly store.** The service depends on a narrow
 *    `LedgerStore` interface (one transaction primitive + a few CRUD
 *    methods). Unit tests use an in-memory implementation; production
 *    binds it to Prisma via `buildLedgerStore` in `prisma-store.ts`.
 *
 * 5. **BigInt everywhere.** Amounts and balances are `bigint` to match
 *    the Prisma schema. Mixing with `number` would risk precision loss
 *    once balances exceed Number.MAX_SAFE_INTEGER cents (~90 trillion
 *    IDR, plausible at platform scale).
 */

import type {
  LedgerDirection,
  LedgerReason,
  WalletAccountType,
} from "@prisma/client";

/* -------------------------------------------------------------------------- */
/* Public row shapes                                                          */
/* -------------------------------------------------------------------------- */

/** A wallet account row, as the service sees it. */
export interface WalletAccountRow {
  id: string;
  userId: string | null;
  type: WalletAccountType;
  currency: string;
  balanceCents: bigint;
}

/** A ledger entry row, as the service sees it. */
export interface LedgerEntryRow {
  id: string;
  accountId: string;
  direction: LedgerDirection;
  amountCents: bigint;
  currency: string;
  reason: LedgerReason;
  orderId: string | null;
  withdrawalId: string | null;
  donationId: string | null;
  idempotencyKey: string | null;
  balanceAfterCents: bigint;
  reversesEntryId: string | null;
  meta: unknown;
  createdAt: Date;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export class LedgerError extends Error {
  readonly code:
    | "ACCOUNT_NOT_FOUND"
    | "ENTRY_NOT_FOUND"
    | "AMOUNT_NOT_POSITIVE"
    | "CURRENCY_MISMATCH"
    | "INSUFFICIENT_FUNDS"
    | "ALREADY_REVERSED"
    | "REVERSAL_OF_REVERSAL"
    | "IMMUTABLE_VIOLATION";
  readonly httpStatus: number;
  constructor(
    code: LedgerError["code"],
    httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "LedgerError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/* -------------------------------------------------------------------------- */
/* Store interface (DI seam)                                                  */
/* -------------------------------------------------------------------------- */

export interface LedgerStore {
  /**
   * Run `fn` inside a single transaction (serialisable in production).
   *
   * The callback receives a transactional view of the same store so all
   * reads/writes inside it are atomic — both the entry insert and the
   * account balance update must succeed together or neither does.
   */
  transaction<T>(fn: (tx: LedgerStore) => Promise<T>): Promise<T>;

  account: {
    findUnique(args: {
      where: { id: string };
    }): Promise<WalletAccountRow | null>;
    /** Find-or-create by `(userId, type, currency)`. userId may be null for system accounts. */
    upsertByOwner(args: {
      userId: string | null;
      type: WalletAccountType;
      currency: string;
    }): Promise<WalletAccountRow>;
    updateBalance(args: {
      where: { id: string };
      balanceCents: bigint;
    }): Promise<WalletAccountRow>;
  };

  entry: {
    findUnique(args: {
      where: { id: string };
    }): Promise<LedgerEntryRow | null>;
    findByIdempotencyKey(key: string): Promise<LedgerEntryRow | null>;
    findReversal(originalId: string): Promise<LedgerEntryRow | null>;
    create(args: {
      data: Omit<LedgerEntryRow, "id" | "createdAt"> & {
        createdAt?: Date;
      };
    }): Promise<LedgerEntryRow>;
    listByAccount(args: {
      accountId: string;
      limit?: number;
      cursor?: string | null;
    }): Promise<LedgerEntryRow[]>;
    /** Sum of (CREDIT - DEBIT) for an account. */
    sumForAccount(accountId: string): Promise<bigint>;
  };
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export interface PostInput {
  accountId: string;
  direction: LedgerDirection;
  amountCents: bigint;
  currency?: string;
  reason: LedgerReason;
  orderId?: string | null;
  withdrawalId?: string | null;
  donationId?: string | null;
  idempotencyKey?: string | null;
  meta?: unknown;
  now?: Date;
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amountCents: bigint;
  reason: LedgerReason;
  orderId?: string | null;
  withdrawalId?: string | null;
  donationId?: string | null;
  idempotencyKey?: string | null;
  meta?: unknown;
  now?: Date;
}

export interface TransferResult {
  debit: LedgerEntryRow;
  credit: LedgerEntryRow;
}

export interface ReverseInput {
  entryId: string;
  reason?: LedgerReason;
  idempotencyKey?: string | null;
  meta?: unknown;
  now?: Date;
}

export interface EnsureAccountInput {
  userId: string | null;
  type: WalletAccountType;
  currency?: string;
}

/**
 * Compute the signed delta a single entry applies to an account balance.
 * CREDIT adds, DEBIT subtracts. Pure — exported for tests and callers
 * that want to project running totals client-side.
 */
export function signedDelta(direction: LedgerDirection, amountCents: bigint): bigint {
  return direction === "CREDIT" ? amountCents : -amountCents;
}

export class LedgerService {
  private readonly store: LedgerStore;
  /**
   * If `true`, postings that would drive an account balance below zero
   * throw `INSUFFICIENT_FUNDS`. Defaults to `true`. Pass `false` only
   * for accounts that legitimately float negative (e.g. internal
   * `SYSTEM` adjustments during reconciliation).
   */
  private readonly enforceNonNegative: boolean;

  constructor(deps: { store: LedgerStore; enforceNonNegative?: boolean }) {
    this.store = deps.store;
    this.enforceNonNegative = deps.enforceNonNegative ?? true;
  }

  /**
   * Find-or-create the wallet account for `(userId, type, currency)`.
   * Useful for callers that don't know whether the account exists yet
   * (e.g. first donation, first order payment).
   */
  async ensureAccount(input: EnsureAccountInput): Promise<WalletAccountRow> {
    return this.store.account.upsertByOwner({
      userId: input.userId,
      type: input.type,
      currency: input.currency ?? "IDR",
    });
  }

  /**
   * Append a single entry to the ledger.
   *
   * Atomicity guarantees:
   *  - The entry insert and account balance update happen in one tx.
   *  - If `idempotencyKey` matches an existing entry, that entry is
   *    returned and no new row is written.
   *  - On `INSUFFICIENT_FUNDS` (when enforced), nothing is written.
   */
  async post(input: PostInput): Promise<LedgerEntryRow> {
    if (input.amountCents <= BigInt(0)) {
      throw new LedgerError(
        "AMOUNT_NOT_POSITIVE",
        400,
        `ledger entry amount must be > 0, got ${input.amountCents}`,
      );
    }

    // Fast-path: idempotency lookup outside tx to avoid contention.
    if (input.idempotencyKey) {
      const existing = await this.store.entry.findByIdempotencyKey(
        input.idempotencyKey,
      );
      if (existing) return existing;
    }

    return this.store.transaction(async (tx) => {
      // Re-check idempotency inside tx in case a parallel writer raced us.
      if (input.idempotencyKey) {
        const existing = await tx.entry.findByIdempotencyKey(
          input.idempotencyKey,
        );
        if (existing) return existing;
      }

      const account = await tx.account.findUnique({
        where: { id: input.accountId },
      });
      if (!account) {
        throw new LedgerError(
          "ACCOUNT_NOT_FOUND",
          404,
          `wallet account ${input.accountId} not found`,
        );
      }

      const currency = input.currency ?? account.currency;
      if (currency !== account.currency) {
        throw new LedgerError(
          "CURRENCY_MISMATCH",
          400,
          `entry currency ${currency} != account currency ${account.currency}`,
        );
      }

      const delta = signedDelta(input.direction, input.amountCents);
      const newBalance = account.balanceCents + delta;
      if (this.enforceNonNegative && newBalance < BigInt(0)) {
        throw new LedgerError(
          "INSUFFICIENT_FUNDS",
          409,
          `account ${account.id} balance would become ${newBalance}`,
        );
      }

      const now = input.now ?? new Date();
      const entry = await tx.entry.create({
        data: {
          accountId: account.id,
          direction: input.direction,
          amountCents: input.amountCents,
          currency,
          reason: input.reason,
          orderId: input.orderId ?? null,
          withdrawalId: input.withdrawalId ?? null,
          donationId: input.donationId ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          balanceAfterCents: newBalance,
          reversesEntryId: null,
          meta: input.meta ?? null,
          createdAt: now,
        },
      });

      await tx.account.updateBalance({
        where: { id: account.id },
        balanceCents: newBalance,
      });

      return entry;
    });
  }

  /**
   * Move `amountCents` from one account to another in a single atomic
   * pair (DEBIT + CREDIT). Both accounts must share the same currency.
   *
   * Idempotency is per-transfer: callers pass a single `idempotencyKey`
   * which is suffixed `:debit` / `:credit` to dedupe both legs.
   */
  async transfer(input: TransferInput): Promise<TransferResult> {
    if (input.fromAccountId === input.toAccountId) {
      throw new LedgerError(
        "AMOUNT_NOT_POSITIVE",
        400,
        "transfer source and destination must differ",
      );
    }
    if (input.amountCents <= BigInt(0)) {
      throw new LedgerError(
        "AMOUNT_NOT_POSITIVE",
        400,
        `transfer amount must be > 0, got ${input.amountCents}`,
      );
    }

    return this.store.transaction(async (tx) => {
      // Validate currency match up-front so we fail fast and atomically.
      const from = await tx.account.findUnique({
        where: { id: input.fromAccountId },
      });
      if (!from) {
        throw new LedgerError(
          "ACCOUNT_NOT_FOUND",
          404,
          `wallet account ${input.fromAccountId} not found`,
        );
      }
      const to = await tx.account.findUnique({
        where: { id: input.toAccountId },
      });
      if (!to) {
        throw new LedgerError(
          "ACCOUNT_NOT_FOUND",
          404,
          `wallet account ${input.toAccountId} not found`,
        );
      }
      if (from.currency !== to.currency) {
        throw new LedgerError(
          "CURRENCY_MISMATCH",
          400,
          `transfer currency mismatch: ${from.currency} -> ${to.currency}`,
        );
      }

      const debitKey = input.idempotencyKey
        ? `${input.idempotencyKey}:debit`
        : null;
      const creditKey = input.idempotencyKey
        ? `${input.idempotencyKey}:credit`
        : null;

      // Use the inner service against the tx store so atomicity is
      // guaranteed by the outer transaction wrapper.
      const inner = new LedgerService({
        store: { ...tx, transaction: (f) => f(tx) },
        enforceNonNegative: this.enforceNonNegative,
      });

      const debit = await inner.post({
        accountId: input.fromAccountId,
        direction: "DEBIT",
        amountCents: input.amountCents,
        currency: from.currency,
        reason: input.reason,
        orderId: input.orderId,
        withdrawalId: input.withdrawalId,
        donationId: input.donationId,
        idempotencyKey: debitKey,
        meta: input.meta,
        now: input.now,
      });

      const credit = await inner.post({
        accountId: input.toAccountId,
        direction: "CREDIT",
        amountCents: input.amountCents,
        currency: to.currency,
        reason: input.reason,
        orderId: input.orderId,
        withdrawalId: input.withdrawalId,
        donationId: input.donationId,
        idempotencyKey: creditKey,
        meta: input.meta,
        now: input.now,
      });

      return { debit, credit };
    });
  }

  /**
   * Reverse an earlier entry by writing a new entry with the opposite
   * direction and a `reversesEntryId` back-pointer. The original is
   * never modified.
   *
   * Constraints:
   *  - The original must exist.
   *  - The original must not itself be a reversal (we don't cascade —
   *    callers wanting to "undo an undo" should `post` a fresh adjustment).
   *  - The original must not already have a reversal pointing at it.
   */
  async reverseEntry(input: ReverseInput): Promise<LedgerEntryRow> {
    return this.store.transaction(async (tx) => {
      const original = await tx.entry.findUnique({
        where: { id: input.entryId },
      });
      if (!original) {
        throw new LedgerError(
          "ENTRY_NOT_FOUND",
          404,
          `ledger entry ${input.entryId} not found`,
        );
      }
      if (original.reversesEntryId) {
        throw new LedgerError(
          "REVERSAL_OF_REVERSAL",
          409,
          `entry ${original.id} is itself a reversal — post an adjustment instead`,
        );
      }
      const existingReversal = await tx.entry.findReversal(original.id);
      if (existingReversal) {
        throw new LedgerError(
          "ALREADY_REVERSED",
          409,
          `entry ${original.id} already reversed by ${existingReversal.id}`,
        );
      }

      const account = await tx.account.findUnique({
        where: { id: original.accountId },
      });
      if (!account) {
        throw new LedgerError(
          "ACCOUNT_NOT_FOUND",
          404,
          `wallet account ${original.accountId} not found`,
        );
      }

      const oppositeDirection: LedgerDirection =
        original.direction === "CREDIT" ? "DEBIT" : "CREDIT";
      const delta = signedDelta(oppositeDirection, original.amountCents);
      const newBalance = account.balanceCents + delta;
      if (this.enforceNonNegative && newBalance < BigInt(0)) {
        throw new LedgerError(
          "INSUFFICIENT_FUNDS",
          409,
          `reversal would drive ${account.id} balance to ${newBalance}`,
        );
      }

      const now = input.now ?? new Date();
      const entry = await tx.entry.create({
        data: {
          accountId: original.accountId,
          direction: oppositeDirection,
          amountCents: original.amountCents,
          currency: original.currency,
          reason: input.reason ?? "REVERSAL",
          orderId: original.orderId,
          withdrawalId: original.withdrawalId,
          donationId: original.donationId,
          idempotencyKey: input.idempotencyKey ?? null,
          balanceAfterCents: newBalance,
          reversesEntryId: original.id,
          meta: input.meta ?? null,
          createdAt: now,
        },
      });

      await tx.account.updateBalance({
        where: { id: account.id },
        balanceCents: newBalance,
      });

      return entry;
    });
  }

  /**
   * Recompute an account's balance from the entry stream and return both
   * the on-account cached value and the freshly summed value. If they
   * disagree, the cache is repaired and the corrected balance returned.
   *
   * Intended for periodic reconciliation jobs, not the hot path.
   */
  async recomputeBalance(accountId: string): Promise<{
    cached: bigint;
    actual: bigint;
    repaired: boolean;
  }> {
    return this.store.transaction(async (tx) => {
      const account = await tx.account.findUnique({ where: { id: accountId } });
      if (!account) {
        throw new LedgerError(
          "ACCOUNT_NOT_FOUND",
          404,
          `wallet account ${accountId} not found`,
        );
      }
      const actual = await tx.entry.sumForAccount(accountId);
      if (actual === account.balanceCents) {
        return { cached: account.balanceCents, actual, repaired: false };
      }
      await tx.account.updateBalance({
        where: { id: accountId },
        balanceCents: actual,
      });
      return { cached: account.balanceCents, actual, repaired: true };
    });
  }

  /** Read a single entry. */
  async getEntry(id: string): Promise<LedgerEntryRow | null> {
    return this.store.entry.findUnique({ where: { id } });
  }

  /** List entries for an account, newest first. Cursor is an entry id. */
  async listEntries(args: {
    accountId: string;
    limit?: number;
    cursor?: string | null;
  }): Promise<LedgerEntryRow[]> {
    return this.store.entry.listByAccount({
      accountId: args.accountId,
      limit: args.limit ?? 50,
      cursor: args.cursor ?? null,
    });
  }

  /** Current cached balance for an account. */
  async getBalance(accountId: string): Promise<bigint> {
    const a = await this.store.account.findUnique({ where: { id: accountId } });
    if (!a) {
      throw new LedgerError(
        "ACCOUNT_NOT_FOUND",
        404,
        `wallet account ${accountId} not found`,
      );
    }
    return a.balanceCents;
  }
}
