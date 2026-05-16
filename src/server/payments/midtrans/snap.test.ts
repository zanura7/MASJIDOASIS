import { describe, expect, it, vi } from "vitest";

import {
  MidtransSnapError,
  createSnapTransaction,
} from "./snap";

const CONFIG = {
  serverKey: "SB-Mid-server-XXXXXXXXXXXX",
  isProduction: false,
};

const VALID_INPUT = {
  orderId: "order-001",
  amountCents: 10_000_000, // Rp 100,000
  itemDetails: [
    { id: "prod-1", price: 50_000, quantity: 2, name: "Test Product" },
  ],
  customerDetail: { email: "buyer@example.com" },
};

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => body,
  } as unknown as Response);
}

function mockFetchFail(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => body,
  } as unknown as Response);
}

describe("createSnapTransaction", () => {
  it("hits the sandbox URL when isProduction=false", async () => {
    const fetchImpl = mockFetchOk({
      token: "snap-token-abc",
      redirect_url: "https://app.sandbox.midtrans.com/snap/v2/redirect/abc",
    });
    await createSnapTransaction(VALID_INPUT, { ...CONFIG, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://app.sandbox.midtrans.com/snap/v1/transactions",
    );
  });

  it("hits the prod URL when isProduction=true", async () => {
    const fetchImpl = mockFetchOk({
      token: "snap-token",
      redirect_url: "https://app.midtrans.com/snap/v2/redirect/x",
    });
    await createSnapTransaction(VALID_INPUT, {
      ...CONFIG,
      isProduction: true,
      fetchImpl,
    });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://app.midtrans.com/snap/v1/transactions");
  });

  it("sends HTTP Basic auth with server_key + trailing colon", async () => {
    const fetchImpl = mockFetchOk({
      token: "t",
      redirect_url: "https://x",
    });
    await createSnapTransaction(VALID_INPUT, { ...CONFIG, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const expected =
      "Basic " + Buffer.from(`${CONFIG.serverKey}:`).toString("base64");
    expect(headers.Authorization).toBe(expected);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("converts amountCents to integer rupiah in gross_amount", async () => {
    const fetchImpl = mockFetchOk({ token: "t", redirect_url: "https://x" });
    await createSnapTransaction(VALID_INPUT, { ...CONFIG, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.transaction_details.gross_amount).toBe(100_000);
    expect(body.transaction_details.order_id).toBe("order-001");
  });

  it("includes item_details verbatim", async () => {
    const fetchImpl = mockFetchOk({ token: "t", redirect_url: "https://x" });
    await createSnapTransaction(VALID_INPUT, { ...CONFIG, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.item_details).toEqual(VALID_INPUT.itemDetails);
  });

  it("returns parsed { token, redirect_url } on success", async () => {
    const fetchImpl = mockFetchOk({
      token: "snap-abc",
      redirect_url: "https://app.sandbox.midtrans.com/snap/v2/redirect/abc",
    });
    const res = await createSnapTransaction(VALID_INPUT, {
      ...CONFIG,
      fetchImpl,
    });
    expect(res.token).toBe("snap-abc");
    expect(res.redirect_url).toContain("/snap/v2/redirect/");
  });

  it("throws MidtransSnapError carrying status + body on non-2xx", async () => {
    const errBody = { error_messages: ["transaction_details.order_id required"] };
    const fetchImpl = mockFetchFail(400, errBody);
    await expect(
      createSnapTransaction(VALID_INPUT, { ...CONFIG, fetchImpl }),
    ).rejects.toMatchObject({
      name: "MidtransSnapError",
      status: 400,
      body: errBody,
    });
  });

  it("rejects amountCents <= 0", async () => {
    await expect(
      createSnapTransaction(
        { ...VALID_INPUT, amountCents: 0 },
        { ...CONFIG, fetchImpl: vi.fn() },
      ),
    ).rejects.toBeInstanceOf(MidtransSnapError);
  });

  it("rejects empty itemDetails", async () => {
    await expect(
      createSnapTransaction(
        { ...VALID_INPUT, itemDetails: [] },
        { ...CONFIG, fetchImpl: vi.fn() },
      ),
    ).rejects.toBeInstanceOf(MidtransSnapError);
  });

  it("rejects amountCents not divisible by 100 (non-whole-rupiah)", async () => {
    await expect(
      createSnapTransaction(
        { ...VALID_INPUT, amountCents: 10_001 },
        { ...CONFIG, fetchImpl: vi.fn() },
      ),
    ).rejects.toBeInstanceOf(MidtransSnapError);
  });

  it("rejects when items sum does not match gross_amount", async () => {
    await expect(
      createSnapTransaction(
        {
          ...VALID_INPUT,
          itemDetails: [{ id: "x", price: 99, quantity: 1, name: "wrong" }],
        },
        { ...CONFIG, fetchImpl: vi.fn() },
      ),
    ).rejects.toBeInstanceOf(MidtransSnapError);
  });

  it("throws on malformed success body (missing token)", async () => {
    const fetchImpl = mockFetchOk({ redirect_url: "https://x" });
    await expect(
      createSnapTransaction(VALID_INPUT, { ...CONFIG, fetchImpl }),
    ).rejects.toBeInstanceOf(MidtransSnapError);
  });
});
