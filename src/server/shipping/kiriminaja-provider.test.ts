import { describe, expect, it, vi } from "vitest";

import { KiriminAjaProvider, KiriminAjaProviderError } from "./kiriminaja-provider";

describe("KiriminAjaProvider", () => {
  it("rejects missing api key", () => {
    expect(
      () =>
        new KiriminAjaProvider({
          apiKey: "",
          baseUrl: "https://api-sandbox.kiriminaja.com/api/mitra",
        }),
    ).toThrow(KiriminAjaProviderError);
  });

  it("requests shipping rates with bearer token and normalized payload", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          data: [
            {
              service: "REG",
              courier: "jne",
              description: "Regular",
              cost: 11000,
              etd: "2-3",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const provider = new KiriminAjaProvider({
      apiKey: "test-key",
      baseUrl: "https://api-sandbox.kiriminaja.com/api/mitra/",
      fetchFn: fetchMock,
    });

    const rates = await provider.getRates({
      origin: "3273",
      destination: "3171",
      weightGram: 1200,
      itemValueCents: 5000000,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api-sandbox.kiriminaja.com/api/mitra/shipping_price",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          origin: "3273",
          destination: "3171",
          weight: 1200,
          item_value: 50000,
        }),
      }),
    );
    expect(rates).toEqual([
      {
        service: "REG",
        courier: "jne",
        description: "Regular",
        costCents: 1100000,
        etd: "2-3",
      },
    ]);
  });

  it("raises provider error on non-2xx response", async () => {
    const provider = new KiriminAjaProvider({
      apiKey: "test-key",
      baseUrl: "https://api-sandbox.kiriminaja.com/api/mitra",
      fetchFn: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ message: "invalid token" }), { status: 401 }),
      ),
    });

    await expect(
      provider.getRates({
        origin: "3273",
        destination: "3171",
        weightGram: 1000,
        itemValueCents: 1000000,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_HTTP_ERROR", httpStatus: 502 });
  });
});
