import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  WithdrawalService,
  WithdrawalError,
  type WithdrawalRow,
  type WithdrawalStore,
} from "./withdrawal-service";

/* -------------------------------------------------------------------------- */
/* In-memory store                                                            */
/* -------------------------------------------------------------------------- */

interface MemDb {
  rows: Map<string, WithdrawalRow>;
}

function makeStore(db: MemDb): WithdrawalStore {
  let seq = 0;
  return {
    async create(args) {
      const id = `wd_${++seq}`;
      const now = new Date();
      const row: WithdrawalRow = {
        id,
        userId: args.userId,
        amountCents: args.amountCents,
        currency: args.currency,
        status: "REQUESTED",
        bankName: args.bankName,
        bankAccountNo: args.bankAccountNo,
        bankAccountName: args.bankAccountName,
        notes: args.notes ?? null,
        approvedById: null,
        approvedAt: null,
        paidAt: null,
        rejectedReason: null,
        createdAt: args.createdAt ?? now,
        updatedAt: args.createdAt ?? now,
      };
      db.rows.set(id, row);
      return row;
    },
    async findUnique({ where }) {
      return db.rows.get(where.id) ?? null;
    },
    async update({ where, data }) {
      const cur = db.rows.get(where.id);
      if (!cur) throw new Error(`mem-store: withdrawal ${where.id} missing`);
      const next: WithdrawalRow = {
        ...cur,
        ...data,
        updatedAt: data.updatedAt ?? new Date(),
      };
      db.rows.set(where.id, next);
      return next;
    },
    async listByUser({ userId, limit = 20 }) {
      return Array.from(db.rows.values())
        .filter((w) => w.userId === userId)
        .slice(0, limit);
    },
    async listAll({ status, limit = 20, offset = 0 }) {
      let rows = Array.from(db.rows.values());
      if (status) rows = rows.filter((w) => w.status === status);
      return rows.slice(offset, offset + limit);
    },
  };
}

function makeLedgerMock() {
  return {
    ensureAccount: vi.fn(),
    transfer: vi.fn(),
    post: vi.fn(),
  };
}

/* -------------------------------------------------------------------------- */
/* requestWithdrawal                                                          */
/* -------------------------------------------------------------------------- */

describe("WithdrawalService.requestWithdrawal", () => {
  let db: MemDb;
  let ledger: ReturnType<typeof makeLedgerMock>;
  let svc: WithdrawalService;

  beforeEach(() => {
    db = { rows: new Map() };
    ledger = makeLedgerMock();
    ledger.ensureAccount.mockResolvedValue({
      id: "acct-balance",
      userId: "seller1",
      type: "USER_BALANCE",
      currency: "IDR",
      balanceCents: BigInt(500000),
    });
    svc = new WithdrawalService({ store: makeStore(db), ledger: ledger as any });
  });

  it("creates a REQUESTED withdrawal when balance is sufficient", async () => {
    const out = await svc.requestWithdrawal({
      userId: "seller1",
      amountCents: BigInt(100000),
      bankName: "BCA",
      bankAccountNo: "1234567890",
      bankAccountName: "Test Seller",
    });

    expect(out.status).toBe("REQUESTED");
    expect(out.amountCents).toBe(BigInt(100000));
    expect(out.userId).toBe("seller1");
    expect(out.bankName).toBe("BCA");
    expect(out.approvedById).toBeNull();
    expect(out.paidAt).toBeNull();
  });

  it("rejects when amount is zero or negative", async () => {
    await expect(
      svc.requestWithdrawal({
        userId: "seller1",
        amountCents: BigInt(0),
        bankName: "BCA",
        bankAccountNo: "1234567890",
        bankAccountName: "Test Seller",
      }),
    ).rejects.toMatchObject({ code: "AMOUNT_NOT_POSITIVE" });
  });

  it("rejects when balance is insufficient", async () => {
    ledger.ensureAccount.mockResolvedValueOnce({
      id: "acct-balance",
      userId: "seller1",
      type: "USER_BALANCE",
      currency: "IDR",
      balanceCents: BigInt(50000),
    });

    await expect(
      svc.requestWithdrawal({
        userId: "seller1",
        amountCents: BigInt(100000),
        bankName: "BCA",
        bankAccountNo: "1234567890",
        bankAccountName: "Test Seller",
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
  });

  it("rejects when bank account fields are blank", async () => {
    await expect(
      svc.requestWithdrawal({
        userId: "seller1",
        amountCents: BigInt(100000),
        bankName: "",
        bankAccountNo: "1234567890",
        bankAccountName: "Test Seller",
      }),
    ).rejects.toMatchObject({ code: "INVALID_BANK_DETAILS" });
  });
});

/* -------------------------------------------------------------------------- */
/* approveWithdrawal                                                          */
/* -------------------------------------------------------------------------- */

describe("WithdrawalService.approveWithdrawal", () => {
  let db: MemDb;
  let ledger: ReturnType<typeof makeLedgerMock>;
  let svc: WithdrawalService;

  beforeEach(() => {
    db = { rows: new Map() };
    ledger = makeLedgerMock();
    svc = new WithdrawalService({ store: makeStore(db), ledger: ledger as any });
  });

  async function seedRequested(amount = BigInt(150000)) {
    ledger.ensureAccount.mockResolvedValue({
      id: "acct-balance",
      balanceCents: BigInt(500000),
      currency: "IDR",
    });
    return svc.requestWithdrawal({
      userId: "seller1",
      amountCents: amount,
      bankName: "BCA",
      bankAccountNo: "1234567890",
      bankAccountName: "Test Seller",
    });
  }

  it("transfers from seller balance to system payout and sets APPROVED", async () => {
    const w = await seedRequested(BigInt(150000));

    ledger.ensureAccount
      .mockResolvedValueOnce({ id: "acct-balance" }) // seller balance
      .mockResolvedValueOnce({ id: "acct-system" }); // system payout
    ledger.transfer.mockResolvedValue({
      debit: { id: "debit" },
      credit: { id: "credit" },
    });

    const approved = await svc.approveWithdrawal({
      withdrawalId: w.id,
      adminId: "admin1",
    });

    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedById).toBe("admin1");
    expect(approved.approvedAt).toBeInstanceOf(Date);

    expect(ledger.transfer).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAccountId: "acct-balance",
        toAccountId: "acct-system",
        amountCents: BigInt(150000),
        reason: "WITHDRAWAL_REQUEST",
        withdrawalId: w.id,
        idempotencyKey: `withdrawal:${w.id}:approve`,
      }),
    );
  });

  it("rejects when withdrawal does not exist", async () => {
    await expect(
      svc.approveWithdrawal({ withdrawalId: "missing", adminId: "admin1" }),
    ).rejects.toMatchObject({ code: "WITHDRAWAL_NOT_FOUND" });
  });

  it("rejects when withdrawal is not REQUESTED", async () => {
    const w = await seedRequested();
    ledger.ensureAccount
      .mockResolvedValueOnce({ id: "acct-balance" })
      .mockResolvedValueOnce({ id: "acct-system" });
    await svc.approveWithdrawal({ withdrawalId: w.id, adminId: "admin1" });

    await expect(
      svc.approveWithdrawal({ withdrawalId: w.id, adminId: "admin1" }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS" });
  });
});

/* -------------------------------------------------------------------------- */
/* rejectWithdrawal                                                           */
/* -------------------------------------------------------------------------- */

describe("WithdrawalService.rejectWithdrawal", () => {
  let db: MemDb;
  let ledger: ReturnType<typeof makeLedgerMock>;
  let svc: WithdrawalService;

  beforeEach(() => {
    db = { rows: new Map() };
    ledger = makeLedgerMock();
    ledger.ensureAccount.mockResolvedValue({
      id: "acct-balance",
      balanceCents: BigInt(500000),
      currency: "IDR",
    });
    svc = new WithdrawalService({ store: makeStore(db), ledger: ledger as any });
  });

  it("marks REQUESTED withdrawal REJECTED with reason and no ledger transfer", async () => {
    const w = await svc.requestWithdrawal({
      userId: "seller1",
      amountCents: BigInt(100000),
      bankName: "BCA",
      bankAccountNo: "1234567890",
      bankAccountName: "Test Seller",
    });

    const out = await svc.rejectWithdrawal({
      withdrawalId: w.id,
      adminId: "admin1",
      reason: "Bukti transfer tidak valid",
    });

    expect(out.status).toBe("REJECTED");
    expect(out.rejectedReason).toBe("Bukti transfer tidak valid");
    expect(out.approvedById).toBe("admin1");
    expect(ledger.transfer).not.toHaveBeenCalled();
  });

  it("rejects when withdrawal is not REQUESTED anymore", async () => {
    const w = await svc.requestWithdrawal({
      userId: "seller1",
      amountCents: BigInt(100000),
      bankName: "BCA",
      bankAccountNo: "1234567890",
      bankAccountName: "Test Seller",
    });
    await svc.rejectWithdrawal({
      withdrawalId: w.id,
      adminId: "admin1",
      reason: "x",
    });

    await expect(
      svc.rejectWithdrawal({
        withdrawalId: w.id,
        adminId: "admin1",
        reason: "y",
      }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS" });
  });
});


/* -------------------------------------------------------------------------- */
/* markPaid + list                                                            */
/* -------------------------------------------------------------------------- */

describe("WithdrawalService.markPaid", () => {
  let db: MemDb;
  let ledger: ReturnType<typeof makeLedgerMock>;
  let svc: WithdrawalService;

  beforeEach(() => {
    db = { rows: new Map() };
    ledger = makeLedgerMock();
    ledger.ensureAccount.mockResolvedValue({
      id: "acct-balance",
      balanceCents: BigInt(500000),
      currency: "IDR",
    });
    svc = new WithdrawalService({ store: makeStore(db), ledger: ledger as any });
  });

  async function approvedWithdrawal() {
    const w = await svc.requestWithdrawal({
      userId: "seller1",
      amountCents: BigInt(100000),
      bankName: "BCA",
      bankAccountNo: "1234567890",
      bankAccountName: "Test Seller",
    });
    ledger.ensureAccount
      .mockResolvedValueOnce({ id: "acct-balance" })
      .mockResolvedValueOnce({ id: "acct-system" });
    ledger.transfer.mockResolvedValue({ debit: { id: "d" }, credit: { id: "c" } });
    return svc.approveWithdrawal({ withdrawalId: w.id, adminId: "admin1" });
  }

  it("marks APPROVED withdrawal as PAID and sets paidAt", async () => {
    const w = await approvedWithdrawal();

    const out = await svc.markPaid({ withdrawalId: w.id, adminId: "admin1" });

    expect(out.status).toBe("PAID");
    expect(out.paidAt).toBeInstanceOf(Date);
    expect(out.approvedById).toBe("admin1");
  });

  it("rejects markPaid when withdrawal is not APPROVED", async () => {
    const w = await svc.requestWithdrawal({
      userId: "seller1",
      amountCents: BigInt(100000),
      bankName: "BCA",
      bankAccountNo: "1234567890",
      bankAccountName: "Test Seller",
    });

    await expect(
      svc.markPaid({ withdrawalId: w.id, adminId: "admin1" }),
    ).rejects.toMatchObject({ code: "INVALID_STATUS" });
  });

  it("lists withdrawals for a user", async () => {
    await svc.requestWithdrawal({
      userId: "seller1",
      amountCents: BigInt(100000),
      bankName: "BCA",
      bankAccountNo: "1234567890",
      bankAccountName: "Test Seller",
    });

    const rows = await svc.listUserWithdrawals({ userId: "seller1" });

    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("seller1");
  });
});
