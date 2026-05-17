import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockRequestWithdrawal = vi.fn();
vi.mock("@/server/wallet/withdrawal-factory", () => ({
  buildWithdrawalService: () => ({
    requestWithdrawal: mockRequestWithdrawal,
  }),
}));

vi.mock("@/server/auth/middleware", () => ({
  requireRole: vi.fn(),
  AuthError: class AuthError extends Error {},
}));

import { requireRole, AuthError } from "@/server/auth/middleware";

describe("POST /api/wallet/withdrawals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeReq(body: any) {
    return new NextRequest("http://localhost/api/wallet/withdrawals", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  it("returns 401 if not SELLER", async () => {
    vi.mocked(requireRole).mockImplementation(() => {
      throw new AuthError("Unauthorized");
    });
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
  });

  it("calls requestWithdrawal and returns 201 on success", async () => {
    vi.mocked(requireRole).mockReturnValue({ sub: "seller1", role: "SELLER" });
    mockRequestWithdrawal.mockResolvedValue({
      id: "w_1",
      userId: "seller1",
      amountCents: BigInt(50000),
      status: "REQUESTED",
    });

    const res = await POST(
      makeReq({
        amountCents: "50000",
        bankName: "BCA",
        bankAccountNo: "123",
        bankAccountName: "Test",
      }),
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.withdrawal.id).toBe("w_1");
    expect(json.withdrawal.amountCents).toBe("50000");

    expect(mockRequestWithdrawal).toHaveBeenCalledWith({
      userId: "seller1",
      amountCents: BigInt(50000),
      bankName: "BCA",
      bankAccountNo: "123",
      bankAccountName: "Test",
      notes: undefined,
    });
  });

  it("returns 400 if missing fields", async () => {
    vi.mocked(requireRole).mockReturnValue({ sub: "seller1", role: "SELLER" });
    const res = await POST(makeReq({ amountCents: "50000" }));
    expect(res.status).toBe(400);
  });
});
