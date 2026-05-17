import { describe, expect, it, vi } from "vitest";

import { EscrowService } from "./escrow-service";

function makeLedgerMock() {
  return {
    ensureAccount: vi.fn(),
    transfer: vi.fn(),
  };
}

describe("EscrowService", () => {
  it("releases buyer escrow to seller balance for completed order", async () => {
    const ledger = makeLedgerMock();
    ledger.ensureAccount
      .mockResolvedValueOnce({ id: "acct-escrow-buyer" })
      .mockResolvedValueOnce({ id: "acct-balance-seller" });
    ledger.transfer.mockResolvedValue({ debit: { id: "debit" }, credit: { id: "credit" } });

    const service = new EscrowService({ ledger });
    const now = new Date("2026-05-17T00:00:00Z");

    await service.releaseOrderEscrow({
      order: {
        id: "order-1",
        buyerId: "buyer-1",
        sellerId: "seller-1",
        status: "COMPLETED",
        totalCents: 11500,
        currency: "IDR",
      },
      now,
    });

    expect(ledger.ensureAccount).toHaveBeenNthCalledWith(1, {
      userId: "buyer-1",
      type: "USER_ESCROW",
      currency: "IDR",
    });
    expect(ledger.ensureAccount).toHaveBeenNthCalledWith(2, {
      userId: "seller-1",
      type: "USER_BALANCE",
      currency: "IDR",
    });
    expect(ledger.transfer).toHaveBeenCalledWith({
      fromAccountId: "acct-escrow-buyer",
      toAccountId: "acct-balance-seller",
      amountCents: 11500n,
      reason: "ORDER_RELEASE",
      orderId: "order-1",
      idempotencyKey: "order:order-1:escrow-release",
      meta: { source: "order_completed" },
      now,
    });
  });

  it("is idempotent by using stable order release key", async () => {
    const ledger = makeLedgerMock();
    ledger.ensureAccount
      .mockResolvedValue({ id: "acct" });

    const service = new EscrowService({ ledger });
    const order = {
      id: "order-2",
      buyerId: "buyer-1",
      sellerId: "seller-1",
      status: "COMPLETED",
      totalCents: 20000,
      currency: "IDR",
    };

    await service.releaseOrderEscrow({ order });
    await service.releaseOrderEscrow({ order });

    expect(ledger.transfer).toHaveBeenNthCalledWith(1, expect.objectContaining({
      idempotencyKey: "order:order-2:escrow-release",
    }));
    expect(ledger.transfer).toHaveBeenNthCalledWith(2, expect.objectContaining({
      idempotencyKey: "order:order-2:escrow-release",
    }));
  });

  it("rejects release when order is not completed", async () => {
    const service = new EscrowService({ ledger: makeLedgerMock() });

    await expect(service.releaseOrderEscrow({
      order: {
        id: "order-3",
        buyerId: "buyer-1",
        sellerId: "seller-1",
        status: "SHIPPED",
        totalCents: 11500,
        currency: "IDR",
      },
    })).rejects.toMatchObject({ code: "ORDER_NOT_COMPLETED" });
  });
});
