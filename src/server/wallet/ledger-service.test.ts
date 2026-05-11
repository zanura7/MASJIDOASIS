import { describe, it, expect, beforeEach } from "vitest";

import {
  LedgerService,
  LedgerError,
  signedDelta,
  type LedgerStore,
  type LedgerEntryRow,
  type WalletAccountRow,
} from "./ledger-service";

/* -------------------------------------------------------------------------- */
/* In-memory store                                                            */
/* -------------------------------------------------------------------------- */

interface MemDb {
  accounts: Map<string, WalletAccountRow>;
  entries: Map<string, LedgerEntryRow>;
}

function makeStore(db: MemDb): LedgerStore {
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}_${++seq}`;

  const store: LedgerStore = {
    async transaction(fn) {
      // Snapshot for rollback on throw — gives our in-memory store the
      // same atomicity guarantee Prisma serialisable txs do, so tests can
      // assert "nothing written on error".
      const snap: MemDb = {
        accounts: new Map(db.accounts),
        entries: new Map(db.entries),
      };
      try {
        return await fn(store);
      } catch (e) {
        db.accounts = snap.accounts;
        db.entries = snap.entries;
        throw e;
      }
    },
    account: {
      async findUnique({ where }) {
        return db.accounts.get(where.id) ?? null;
      },
      async upsertByOwner({ userId, type, currency }) {
        for (const a of db.accounts.values()) {
          if (
            a.userId === userId &&
            a.type === type &&
            a.currency === currency
          ) {
            return a;
          }
        }
        const id = nextId("acct");
        const row: WalletAccountRow = {
          id,
          userId,
          type,
          currency,
          balanceCents: BigInt(0),
        };
        db.accounts.set(id, row);
        return row;
      },
      async updateBalance({ where, balanceCents }) {
        const cur = db.accounts.get(where.id);
        if (!cur) throw new Error(`mem-store: account ${where.id} missing`);
        const next = { ...cur, balanceCents };
        db.accounts.set(where.id, next);
        return next;
      },
    },
    entry: {
      async findUnique({ where }) {
        return db.entries.get(where.id) ?? null;
      },
      async findByIdempotencyKey(key) {
        for (const e of db.entries.values()) {
          if (e.idempotencyKey === key) return e;
        }
        return null;
      },
      async findReversal(originalId) {
        for (const e of db.entries.values()) {
          if (e.reversesEntryId === originalId) return e;
        }
        return null;
      },
      async create({ data }) {
        const id = nextId("entry");
        const row: LedgerEntryRow = {
          id,
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
          meta: data.meta,
          createdAt: data.createdAt ?? new Date(),
        };
        db.entries.set(id, row);
        return row;
      },
      async listByAccount({ accountId, limit = 50, cursor = null }) {
        const all = [...db.entries.values()]
          .filter((e) => e.accountId === accountId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        let start = 0;
        if (cursor) {
          const idx = all.findIndex((e) => e.id === cursor);
          start = idx >= 0 ? idx + 1 : 0;
        }
        return all.slice(start, start + limit);
      },
      async sumForAccount(accountId) {
        let total = BigInt(0);
        for (const e of db.entries.values()) {
          if (e.accountId !== accountId) continue;
          total += signedDelta(e.direction, e.amountCents);
        }
        return total;
      },
    },
  };
  return store;
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

function freshDb(): MemDb {
  return { accounts: new Map(), entries: new Map() };
}

async function makeAccount(
  svc: LedgerService,
  userId: string | null,
  type:
    | "USER_ESCROW"
    | "USER_BALANCE"
    | "PLATFORM_FEE"
    | "SYSTEM" = "USER_BALANCE",
) {
  return svc.ensureAccount({ userId, type });
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe("signedDelta", () => {
  it("CREDIT adds, DEBIT subtracts", () => {
    expect(signedDelta("CREDIT", BigInt(500))).toBe(BigInt(500));
    expect(signedDelta("DEBIT", BigInt(500))).toBe(-BigInt(500));
  });
});

describe("LedgerService.ensureAccount", () => {
  it("creates a new account with zero balance", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const a = await svc.ensureAccount({ userId: "u1", type: "USER_BALANCE" });
    expect(a.balanceCents).toBe(BigInt(0));
    expect(a.currency).toBe("IDR");
  });

  it("is idempotent on (userId, type, currency)", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const a = await svc.ensureAccount({ userId: "u1", type: "USER_BALANCE" });
    const b = await svc.ensureAccount({ userId: "u1", type: "USER_BALANCE" });
    expect(b.id).toBe(a.id);
    expect(db.accounts.size).toBe(1);
  });

  it("treats null userId as a distinct system account slot", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const platform = await svc.ensureAccount({
      userId: null,
      type: "PLATFORM_FEE",
    });
    const user = await svc.ensureAccount({
      userId: "u1",
      type: "PLATFORM_FEE",
    });
    expect(platform.id).not.toBe(user.id);
  });
});

describe("LedgerService.post", () => {
  it("appends a CREDIT and updates the balance + balanceAfter", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    const e = await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(10_000),
      reason: "ORDER_PAYMENT",
    });
    expect(e.balanceAfterCents).toBe(BigInt(10_000));
    expect(await svc.getBalance(acct.id)).toBe(BigInt(10_000));
  });

  it("appends a DEBIT and updates the balance", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(10_000),
      reason: "ORDER_PAYMENT",
    });
    const e = await svc.post({
      accountId: acct.id,
      direction: "DEBIT",
      amountCents: BigInt(3_000),
      reason: "WITHDRAWAL_PAYOUT",
    });
    expect(e.balanceAfterCents).toBe(BigInt(7_000));
    expect(await svc.getBalance(acct.id)).toBe(BigInt(7_000));
  });

  it("rejects non-positive amounts", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    await expect(
      svc.post({
        accountId: acct.id,
        direction: "CREDIT",
        amountCents: BigInt(0),
        reason: "ORDER_PAYMENT",
      }),
    ).rejects.toMatchObject({ code: "AMOUNT_NOT_POSITIVE" });
    await expect(
      svc.post({
        accountId: acct.id,
        direction: "CREDIT",
        amountCents: -BigInt(5),
        reason: "ORDER_PAYMENT",
      }),
    ).rejects.toMatchObject({ code: "AMOUNT_NOT_POSITIVE" });
  });

  it("rejects unknown account", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    await expect(
      svc.post({
        accountId: "missing",
        direction: "CREDIT",
        amountCents: BigInt(100),
        reason: "ORDER_PAYMENT",
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  it("rejects currency mismatch", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    await expect(
      svc.post({
        accountId: acct.id,
        direction: "CREDIT",
        amountCents: BigInt(100),
        currency: "USD",
        reason: "ORDER_PAYMENT",
      }),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
  });

  it("blocks DEBIT that would drive balance negative (default policy)", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(100),
      reason: "ORDER_PAYMENT",
    });
    await expect(
      svc.post({
        accountId: acct.id,
        direction: "DEBIT",
        amountCents: BigInt(200),
        reason: "WITHDRAWAL_PAYOUT",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    // Balance unchanged after the failed attempt.
    expect(await svc.getBalance(acct.id)).toBe(BigInt(100));
  });

  it("allows negative balances when enforceNonNegative=false", async () => {
    const db = freshDb();
    const svc = new LedgerService({
      store: makeStore(db),
      enforceNonNegative: false,
    });
    const acct = await makeAccount(svc, null, "SYSTEM");
    const e = await svc.post({
      accountId: acct.id,
      direction: "DEBIT",
      amountCents: BigInt(500),
      reason: "ADJUSTMENT",
    });
    expect(e.balanceAfterCents).toBe(-BigInt(500));
  });

  it("idempotency: same key returns the same entry, no second row", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    const first = await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(250),
      reason: "ORDER_PAYMENT",
      idempotencyKey: "midtrans:evt_123",
    });
    const second = await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(250),
      reason: "ORDER_PAYMENT",
      idempotencyKey: "midtrans:evt_123",
    });
    expect(second.id).toBe(first.id);
    expect(db.entries.size).toBe(1);
    expect(await svc.getBalance(acct.id)).toBe(BigInt(250));
  });

  it("multiple entries accumulate balanceAfter correctly", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    const a = await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(100),
      reason: "ORDER_PAYMENT",
    });
    const b = await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(50),
      reason: "ORDER_PAYMENT",
    });
    const c = await svc.post({
      accountId: acct.id,
      direction: "DEBIT",
      amountCents: BigInt(30),
      reason: "WITHDRAWAL_PAYOUT",
    });
    expect(a.balanceAfterCents).toBe(BigInt(100));
    expect(b.balanceAfterCents).toBe(BigInt(150));
    expect(c.balanceAfterCents).toBe(BigInt(120));
  });
});

describe("LedgerService.transfer", () => {
  it("moves funds between two accounts atomically", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const a = await makeAccount(svc, "u1", "USER_ESCROW");
    const b = await makeAccount(svc, "u1", "USER_BALANCE");
    await svc.post({
      accountId: a.id,
      direction: "CREDIT",
      amountCents: BigInt(1_000),
      reason: "ORDER_PAYMENT",
    });
    const result = await svc.transfer({
      fromAccountId: a.id,
      toAccountId: b.id,
      amountCents: BigInt(400),
      reason: "ORDER_RELEASE",
    });
    expect(result.debit.direction).toBe("DEBIT");
    expect(result.credit.direction).toBe("CREDIT");
    expect(await svc.getBalance(a.id)).toBe(BigInt(600));
    expect(await svc.getBalance(b.id)).toBe(BigInt(400));
  });

  it("rolls back if source has insufficient funds", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const a = await makeAccount(svc, "u1", "USER_ESCROW");
    const b = await makeAccount(svc, "u1", "USER_BALANCE");
    await svc.post({
      accountId: a.id,
      direction: "CREDIT",
      amountCents: BigInt(100),
      reason: "ORDER_PAYMENT",
    });
    await expect(
      svc.transfer({
        fromAccountId: a.id,
        toAccountId: b.id,
        amountCents: BigInt(500),
        reason: "ORDER_RELEASE",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    // Neither side moved.
    expect(await svc.getBalance(a.id)).toBe(BigInt(100));
    expect(await svc.getBalance(b.id)).toBe(BigInt(0));
    // Critically: no half-written entries left behind.
    expect(db.entries.size).toBe(1); // the initial seed credit only
  });

  it("rejects same-account transfer", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const a = await makeAccount(svc, "u1");
    await expect(
      svc.transfer({
        fromAccountId: a.id,
        toAccountId: a.id,
        amountCents: BigInt(100),
        reason: "ADJUSTMENT",
      }),
    ).rejects.toMatchObject({ code: "AMOUNT_NOT_POSITIVE" });
  });

  it("rejects currency mismatch", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const a = await svc.ensureAccount({
      userId: "u1",
      type: "USER_BALANCE",
      currency: "IDR",
    });
    const b = await svc.ensureAccount({
      userId: "u2",
      type: "USER_BALANCE",
      currency: "USD",
    });
    await expect(
      svc.transfer({
        fromAccountId: a.id,
        toAccountId: b.id,
        amountCents: BigInt(100),
        reason: "ADJUSTMENT",
      }),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
  });

  it("idempotency: same transfer key returns same pair", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const a = await makeAccount(svc, "u1", "USER_ESCROW");
    const b = await makeAccount(svc, "u1", "USER_BALANCE");
    await svc.post({
      accountId: a.id,
      direction: "CREDIT",
      amountCents: BigInt(1_000),
      reason: "ORDER_PAYMENT",
    });
    const first = await svc.transfer({
      fromAccountId: a.id,
      toAccountId: b.id,
      amountCents: BigInt(300),
      reason: "ORDER_RELEASE",
      idempotencyKey: "release:order_42",
    });
    const second = await svc.transfer({
      fromAccountId: a.id,
      toAccountId: b.id,
      amountCents: BigInt(300),
      reason: "ORDER_RELEASE",
      idempotencyKey: "release:order_42",
    });
    expect(second.debit.id).toBe(first.debit.id);
    expect(second.credit.id).toBe(first.credit.id);
    // Only 3 entries total: initial seed + debit + credit.
    expect(db.entries.size).toBe(3);
    expect(await svc.getBalance(a.id)).toBe(BigInt(700));
    expect(await svc.getBalance(b.id)).toBe(BigInt(300));
  });
});

describe("LedgerService.reverseEntry", () => {
  it("writes an opposite-direction entry pointing at the original", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    const original = await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(500),
      reason: "ORDER_PAYMENT",
    });
    const reversal = await svc.reverseEntry({
      entryId: original.id,
      reason: "REVERSAL",
    });
    expect(reversal.direction).toBe("DEBIT");
    expect(reversal.amountCents).toBe(BigInt(500));
    expect(reversal.reversesEntryId).toBe(original.id);
    expect(await svc.getBalance(acct.id)).toBe(BigInt(0));
  });

  it("leaves the original entry intact (immutability invariant)", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    const original = await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(500),
      reason: "ORDER_PAYMENT",
    });
    const snapshot = { ...original };
    await svc.reverseEntry({ entryId: original.id });
    const stillThere = await svc.getEntry(original.id);
    expect(stillThere).toMatchObject({
      id: snapshot.id,
      direction: snapshot.direction,
      amountCents: snapshot.amountCents,
      balanceAfterCents: snapshot.balanceAfterCents,
      reversesEntryId: null,
    });
  });

  it("rejects double-reversal of the same entry", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    const original = await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(500),
      reason: "ORDER_PAYMENT",
    });
    await svc.reverseEntry({ entryId: original.id });
    await expect(
      svc.reverseEntry({ entryId: original.id }),
    ).rejects.toMatchObject({ code: "ALREADY_REVERSED" });
  });

  it("rejects reversal of a reversal entry", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    const original = await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(500),
      reason: "ORDER_PAYMENT",
    });
    const reversal = await svc.reverseEntry({ entryId: original.id });
    await expect(
      svc.reverseEntry({ entryId: reversal.id }),
    ).rejects.toMatchObject({ code: "REVERSAL_OF_REVERSAL" });
  });

  it("rejects reversal of an unknown entry", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    await expect(
      svc.reverseEntry({ entryId: "nope" }),
    ).rejects.toMatchObject({ code: "ENTRY_NOT_FOUND" });
  });

  it("blocks reversal that would drive balance negative", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    const credit = await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(1_000),
      reason: "ORDER_PAYMENT",
    });
    // Spend most of it.
    await svc.post({
      accountId: acct.id,
      direction: "DEBIT",
      amountCents: BigInt(900),
      reason: "WITHDRAWAL_PAYOUT",
    });
    // Reverting the original 1000 credit would leave -800 — not allowed.
    await expect(
      svc.reverseEntry({ entryId: credit.id }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
  });
});

describe("LedgerService.recomputeBalance", () => {
  it("returns equal cached/actual when in sync", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(100),
      reason: "ORDER_PAYMENT",
    });
    const r = await svc.recomputeBalance(acct.id);
    expect(r.cached).toBe(BigInt(100));
    expect(r.actual).toBe(BigInt(100));
    expect(r.repaired).toBe(false);
  });

  it("repairs a drifted cache", async () => {
    const db = freshDb();
    const store = makeStore(db);
    const svc = new LedgerService({ store });
    const acct = await makeAccount(svc, "u1");
    await svc.post({
      accountId: acct.id,
      direction: "CREDIT",
      amountCents: BigInt(100),
      reason: "ORDER_PAYMENT",
    });
    // Simulate cache corruption (e.g. operator wrote SQL directly).
    await store.account.updateBalance({
      where: { id: acct.id },
      balanceCents: BigInt(999),
    });
    const r = await svc.recomputeBalance(acct.id);
    expect(r.cached).toBe(BigInt(999));
    expect(r.actual).toBe(BigInt(100));
    expect(r.repaired).toBe(true);
    expect(await svc.getBalance(acct.id)).toBe(BigInt(100));
  });
});

describe("LedgerService.listEntries", () => {
  it("returns newest first and respects limit + cursor", async () => {
    const db = freshDb();
    const svc = new LedgerService({ store: makeStore(db) });
    const acct = await makeAccount(svc, "u1");
    const t0 = new Date("2026-01-01T00:00:00Z");
    const created: LedgerEntryRow[] = [];
    for (let i = 0; i < 5; i++) {
      created.push(
        await svc.post({
          accountId: acct.id,
          direction: "CREDIT",
          amountCents: BigInt(100),
          reason: "ORDER_PAYMENT",
          now: new Date(t0.getTime() + i * 1000),
        }),
      );
    }
    const page1 = await svc.listEntries({ accountId: acct.id, limit: 2 });
    expect(page1.map((e) => e.id)).toEqual([
      created[4]!.id,
      created[3]!.id,
    ]);
    const page2 = await svc.listEntries({
      accountId: acct.id,
      limit: 2,
      cursor: page1[1]!.id,
    });
    expect(page2.map((e) => e.id)).toEqual([
      created[2]!.id,
      created[1]!.id,
    ]);
  });
});

describe("LedgerError shape", () => {
  it("carries code and httpStatus for route handlers", () => {
    const e = new LedgerError("AMOUNT_NOT_POSITIVE", 400, "bad");
    expect(e.code).toBe("AMOUNT_NOT_POSITIVE");
    expect(e.httpStatus).toBe(400);
    expect(e.name).toBe("LedgerError");
  });
});
