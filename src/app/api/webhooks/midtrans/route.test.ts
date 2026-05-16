/**
 * Integration tests for POST /api/webhooks/midtrans
 *
 * Covers:
 * - Signature validation (valid/invalid/missing)
 * - Idempotency via WebhookEvent unique constraint
 * - Amount mismatch detection
 * - Ledger transfer (SYSTEM → USER_ESCROW)
 * - Non-PAID outcomes (pending, denied, expired) → ACK without state change
 *
 * MAS-38.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { computeMidtransSignature } from "@/server/payments/midtrans/signature";

// Mock modules
vi.mock("@/server/db", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/server/marketplace/order-lifecycle-service");
vi.mock("@/server/marketplace/prisma-stores");
vi.mock("@/server/wallet/ledger-service");
vi.mock("@/lib/env", () => ({
  getEnv: vi.fn(() => ({
    MIDTRANS_SERVER_KEY: "test-server-key-12345",
  })),
}));

const SERVER_KEY = "test-server-key-12345";

function buildNotification(overrides: Record<string, unknown> = {}) {
  const base = {
    order_id: "ORD-20260516-001-1",
    status_code: "200",
    gross_amount: "150000.00",
    transaction_status: "settlement",
    transaction_id: "txn-abc123",
    payment_type: "bank_transfer",
    transaction_time: "2026-05-16 11:00:00",
    ...overrides,
  };
  const signature = computeMidtransSignature({
    orderId: base.order_id,
    statusCode: base.status_code,
    grossAmount: base.gross_amount,
    serverKey: SERVER_KEY,
  });
  return { ...base, signature_key: signature };
}

function mockRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

describe("POST /api/webhooks/midtrans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-JSON body", async () => {
    const req = {
      json: async () => {
        throw new Error("invalid json");
      },
    } as unknown as NextRequest;

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe("BAD_BODY");
  });

  it("rejects missing required fields", async () => {
    const req = mockRequest({ order_id: "test" }); // missing other fields

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe("BAD_SHAPE");
  });

  it("rejects invalid signature", async () => {
    const { prisma } = await import("@/server/db");
    // Mock order exists so we reach signature check
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "order-123",
      code: "ORD-20260516-001",
      buyerId: "user-456",
      totalCents: BigInt(15000000),
      currency: "IDR",
      status: "PENDING",
      paymentStatus: "PENDING",
    } as any);

    const note = buildNotification();
    note.signature_key = "wrong-signature-hex";

    const req = mockRequest(note);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.code).toBe("BAD_SIGNATURE");
  });

  it("rejects unparseable order_id", async () => {
    const note = buildNotification({ order_id: "invalid-format" });
    // Recompute signature for the new order_id
    note.signature_key = computeMidtransSignature({
      orderId: note.order_id,
      statusCode: note.status_code,
      grossAmount: note.gross_amount,
      serverKey: SERVER_KEY,
    });

    const req = mockRequest(note);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.code).toBe("BAD_ORDER_ID");
  });

  it("returns 404 when order not found", async () => {
    const { prisma } = await import("@/server/db");
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

    const note = buildNotification();
    const req = mockRequest(note);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.code).toBe("ORDER_NOT_FOUND");
  });

  it("ACKs non-PAID outcomes without state change", async () => {
    const { prisma } = await import("@/server/db");
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "order-123",
      code: "ORD-20260516-001",
      buyerId: "user-456",
      totalCents: BigInt(15000000), // 150000.00 IDR
      currency: "IDR",
      status: "PENDING",
      paymentStatus: "PENDING",
    } as any);

    const note = buildNotification({ transaction_status: "pending" });
    const req = mockRequest(note);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.status).toBe("acknowledged");
    expect(json.outcome).toBe("PENDING");
  });

  it("rejects amount mismatch", async () => {
    const { prisma } = await import("@/server/db");
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "order-123",
      code: "ORD-20260516-001",
      buyerId: "user-456",
      totalCents: BigInt(20000000), // 200000.00 IDR (mismatch!)
      currency: "IDR",
      status: "PENDING",
      paymentStatus: "PENDING",
    } as any);

    const note = buildNotification(); // gross_amount = 150000.00
    const req = mockRequest(note);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.code).toBe("AMOUNT_MISMATCH");
  });

  it("marks order paid and transfers to escrow on settlement", async () => {
    const { prisma } = await import("@/server/db");
    const { OrderLifecycleService } = await import(
      "@/server/marketplace/order-lifecycle-service"
    );
    const { LedgerService } = await import("@/server/wallet/ledger-service");

    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "order-123",
      code: "ORD-20260516-001",
      buyerId: "user-456",
      totalCents: BigInt(15000000), // 150000.00 IDR
      currency: "IDR",
      status: "PENDING",
      paymentStatus: "PENDING",
    } as any);

    const mockMarkPaid = vi.fn().mockResolvedValue(undefined);
    vi.mocked(OrderLifecycleService).mockImplementation(
      function (this: any) {
        this.markPaid = mockMarkPaid;
      } as any,
    );

    const mockEnsureAccount = vi.fn();
    mockEnsureAccount
      .mockResolvedValueOnce({ id: "acct-system" }) // SYSTEM
      .mockResolvedValueOnce({ id: "acct-escrow-user456" }); // USER_ESCROW

    const mockTransfer = vi.fn().mockResolvedValue(undefined);
    vi.mocked(LedgerService).mockImplementation(
      function (this: any) {
        this.ensureAccount = mockEnsureAccount;
        this.transfer = mockTransfer;
      } as any,
    );

    const note = buildNotification();
    const req = mockRequest(note);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.status).toBe("paid");
    expect(json.transactionId).toBe("txn-abc123");

    expect(mockMarkPaid).toHaveBeenCalledWith({
      provider: "midtrans",
      externalId: "txn-abc123",
      orderId: "order-123",
      payload: expect.objectContaining({ transaction_id: "txn-abc123" }),
      signature: note.signature_key,
    });

    expect(mockTransfer).toHaveBeenCalledWith({
      fromAccountId: "acct-system",
      toAccountId: "acct-escrow-user456",
      amountCents: BigInt(15000000),
      reason: "ORDER_PAYMENT",
      orderId: "order-123",
      idempotencyKey: "midtrans:txn-abc123:escrow",
      meta: expect.objectContaining({
        provider: "midtrans",
        transactionId: "txn-abc123",
      }),
    });
  });

  it("handles WEBHOOK_ALREADY_PROCESSED gracefully (idempotency)", async () => {
    const { prisma } = await import("@/server/db");
    const { OrderLifecycleService } = await import(
      "@/server/marketplace/order-lifecycle-service"
    );
    const { LedgerService } = await import("@/server/wallet/ledger-service");

    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "order-123",
      code: "ORD-20260516-001",
      buyerId: "user-456",
      totalCents: BigInt(15000000),
      currency: "IDR",
      status: "PAID",
      paymentStatus: "PAID",
    } as any);

    const mockMarkPaid = vi.fn().mockRejectedValue({
      code: "WEBHOOK_ALREADY_PROCESSED",
      message: "webhook already processed",
      httpStatus: 200,
    });
    vi.mocked(OrderLifecycleService).mockImplementation(
      function (this: any) {
        this.markPaid = mockMarkPaid;
      } as any,
    );

    const mockEnsureAccount = vi.fn();
    mockEnsureAccount
      .mockResolvedValueOnce({ id: "acct-system" })
      .mockResolvedValueOnce({ id: "acct-escrow-user456" });

    const mockTransfer = vi.fn().mockResolvedValue(undefined);
    vi.mocked(LedgerService).mockImplementation(
      function (this: any) {
        this.ensureAccount = mockEnsureAccount;
        this.transfer = mockTransfer;
      } as any,
    );

    const note = buildNotification();
    const req = mockRequest(note);
    const res = await POST(req);
    const json = await res.json();

    // Should still succeed (idempotent)
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.status).toBe("paid");
  });
});
