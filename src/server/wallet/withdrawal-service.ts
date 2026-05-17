/**
 * Withdrawal service — MAS-7 wallet withdrawal flow.
 *
 * Seller requests withdrawal from USER_BALANCE → admin approves/rejects.
 * On approval, ledger transfers USER_BALANCE → system payout account.
 * On rejection, status changes only, no ledger movement.
 */

import type { WithdrawalStatus } from "@prisma/client";
import type { LedgerService } from "./ledger-service";

/* -------------------------------------------------------------------------- */
/* Public row shapes                                                          */
/* -------------------------------------------------------------------------- */

export interface WithdrawalRow {
  id: string;
  userId: string;
  amountCents: bigint;
  currency: string;
  status: WithdrawalStatus;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  notes: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  rejectedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/* Store interface                                                            */
/* -------------------------------------------------------------------------- */

export interface WithdrawalStore {
  create(args: {
    userId: string;
    amountCents: bigint;
    currency: string;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    notes?: string;
    createdAt?: Date;
  }): Promise<WithdrawalRow>;

  findUnique(args: { where: { id: string } }): Promise<WithdrawalRow | null>;

  update(args: {
    where: { id: string };
    data: Partial<WithdrawalRow>;
  }): Promise<WithdrawalRow>;

  listByUser(args: { userId: string; limit?: number }): Promise<WithdrawalRow[]>;

  listAll(args: {
    status?: WithdrawalStatus;
    limit?: number;
    offset?: number;
  }): Promise<WithdrawalRow[]>;
}

/* -------------------------------------------------------------------------- */
/* Error codes                                                                */
/* -------------------------------------------------------------------------- */

export class WithdrawalError extends Error {
  constructor(
    public code:
      | "AMOUNT_NOT_POSITIVE"
      | "INSUFFICIENT_BALANCE"
      | "INVALID_BANK_DETAILS"
      | "WITHDRAWAL_NOT_FOUND"
      | "INVALID_STATUS",
    message: string,
  ) {
    super(message);
    this.name = "WithdrawalError";
  }
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export class WithdrawalService {
  constructor(
    private deps: {
      store: WithdrawalStore;
      ledger: LedgerService;
    },
  ) {}

  /**
   * Seller requests withdrawal from their USER_BALANCE.
   * Validates amount > 0, balance sufficient, bank details present.
   */
  async requestWithdrawal(args: {
    userId: string;
    amountCents: bigint;
    bankName: string;
    bankAccountNo: string;
    bankAccountName: string;
    notes?: string;
  }): Promise<WithdrawalRow> {
    const { userId, amountCents, bankName, bankAccountNo, bankAccountName, notes } = args;

    // Validate amount
    if (amountCents <= BigInt(0)) {
      throw new WithdrawalError("AMOUNT_NOT_POSITIVE", "Amount must be positive");
    }

    // Validate bank details
    if (!bankName.trim() || !bankAccountNo.trim() || !bankAccountName.trim()) {
      throw new WithdrawalError("INVALID_BANK_DETAILS", "Bank details required");
    }

    // Check balance
    const balanceAcct = await this.deps.ledger.ensureAccount({
      userId,
      type: "USER_BALANCE",
      currency: "IDR",
    });

    if (balanceAcct.balanceCents < amountCents) {
      throw new WithdrawalError(
        "INSUFFICIENT_BALANCE",
        `Balance ${balanceAcct.balanceCents} < requested ${amountCents}`,
      );
    }

    // Create withdrawal record
    return this.deps.store.create({
      userId,
      amountCents,
      currency: "IDR",
      bankName,
      bankAccountNo,
      bankAccountName,
      notes,
    });
  }

  /**
   * Admin approves withdrawal → transfer USER_BALANCE → system payout.
   * Idempotent via ledger key.
   */
  async approveWithdrawal(args: {
    withdrawalId: string;
    adminId: string;
  }): Promise<WithdrawalRow> {
    const { withdrawalId, adminId } = args;

    const w = await this.deps.store.findUnique({ where: { id: withdrawalId } });
    if (!w) {
      throw new WithdrawalError("WITHDRAWAL_NOT_FOUND", `Withdrawal ${withdrawalId} not found`);
    }

    if (w.status !== "REQUESTED") {
      throw new WithdrawalError(
        "INVALID_STATUS",
        `Withdrawal ${withdrawalId} status is ${w.status}, expected REQUESTED`,
      );
    }

    // Get accounts
    const fromAcct = await this.deps.ledger.ensureAccount({
      userId: w.userId,
      type: "USER_BALANCE",
      currency: w.currency,
    });
    const toAcct = await this.deps.ledger.ensureAccount({
      userId: null,
      type: "SYSTEM",
      currency: w.currency,
    });

    // Transfer ledger
    await this.deps.ledger.transfer({
      fromAccountId: fromAcct.id,
      toAccountId: toAcct.id,
      amountCents: w.amountCents,
      reason: "WITHDRAWAL_REQUEST",
      withdrawalId: w.id,
      idempotencyKey: `withdrawal:${w.id}:approve`,
    });

    // Update withdrawal
    return this.deps.store.update({
      where: { id: w.id },
      data: {
        status: "APPROVED",
        approvedById: adminId,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Admin rejects withdrawal → status change only, no ledger movement.
   */
  async rejectWithdrawal(args: {
    withdrawalId: string;
    adminId: string;
    reason: string;
  }): Promise<WithdrawalRow> {
    const { withdrawalId, adminId, reason } = args;

    const w = await this.deps.store.findUnique({ where: { id: withdrawalId } });
    if (!w) {
      throw new WithdrawalError("WITHDRAWAL_NOT_FOUND", `Withdrawal ${withdrawalId} not found`);
    }

    if (w.status !== "REQUESTED") {
      throw new WithdrawalError(
        "INVALID_STATUS",
        `Withdrawal ${withdrawalId} status is ${w.status}, expected REQUESTED`,
      );
    }

    return this.deps.store.update({
      where: { id: w.id },
      data: {
        status: "REJECTED",
        approvedById: adminId,
        rejectedReason: reason,
      },
    });
  }

  /**
   * Admin marks an APPROVED withdrawal as PAID after manual bank transfer.
   * No ledger movement (already moved to SYSTEM on approve).
   */
  async markPaid(args: {
    withdrawalId: string;
    adminId: string;
  }): Promise<WithdrawalRow> {
    const { withdrawalId, adminId } = args;

    const w = await this.deps.store.findUnique({ where: { id: withdrawalId } });
    if (!w) {
      throw new WithdrawalError("WITHDRAWAL_NOT_FOUND", `Withdrawal ${withdrawalId} not found`);
    }

    if (w.status !== "APPROVED") {
      throw new WithdrawalError(
        "INVALID_STATUS",
        `Withdrawal ${withdrawalId} status is ${w.status}, expected APPROVED`,
      );
    }

    return this.deps.store.update({
      where: { id: w.id },
      data: {
        status: "PAID",
        approvedById: adminId, // update last actor
        paidAt: new Date(),
      },
    });
  }

  /**
   * List withdrawals for a seller.
   */
  async listUserWithdrawals(args: { userId: string; limit?: number }): Promise<WithdrawalRow[]> {
    return this.deps.store.listByUser(args);
  }

  /**
   * Admin: list all withdrawals, optionally filtered by status.
   */
  async listAll(args: {
    status?: WithdrawalStatus;
    limit?: number;
    offset?: number;
  }): Promise<WithdrawalRow[]> {
    return this.deps.store.listAll(args);
  }
}
