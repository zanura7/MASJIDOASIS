import { describe, it, expect, vi } from "vitest";
import { FonnteOtpProvider } from "./fonnte";
import { OtpDeliveryError, OtpConfigurationError } from "./types";

function mockFetch(response: { status?: number; json?: unknown; throws?: unknown }) {
  return vi.fn(async () => {
    if (response.throws) throw response.throws;
    return new Response(JSON.stringify(response.json ?? {}), {
      status: response.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("FonnteOtpProvider", () => {
  it("requires an api key", () => {
    expect(() => new FonnteOtpProvider({ apiKey: "" })).toThrow(OtpConfigurationError);
  });

  it("sends a normalised request and returns the message id", async () => {
    const fetchImpl = mockFetch({ json: { status: true, id: ["msg-123"] } });
    const p = new FonnteOtpProvider({
      apiKey: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await p.send({
      phone: "08123456789",
      code: "123456",
      message: "Kode: 123456",
    });

    expect(result.provider).toBe("fonnte");
    expect(result.channel).toBe("whatsapp");
    expect(result.providerMessageId).toBe("msg-123");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("secret");
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain("target=628123456789");
    expect(body).toContain("message=Kode%3A+123456");
  });

  it("throws OtpDeliveryError on status:false body", async () => {
    const fetchImpl = mockFetch({ json: { status: false, reason: "device offline" } });
    const p = new FonnteOtpProvider({
      apiKey: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(
      p.send({ phone: "+628123456789", code: "1", message: "x" }),
    ).rejects.toBeInstanceOf(OtpDeliveryError);
  });

  it("throws OtpDeliveryError on HTTP 5xx", async () => {
    const fetchImpl = mockFetch({ status: 502, json: { reason: "bad gateway" } });
    const p = new FonnteOtpProvider({
      apiKey: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(
      p.send({ phone: "+628123456789", code: "1", message: "x" }),
    ).rejects.toMatchObject({ name: "OtpDeliveryError", status: 502 });
  });

  it("throws OtpDeliveryError on network failure", async () => {
    const fetchImpl = mockFetch({ throws: new Error("ECONNRESET") });
    const p = new FonnteOtpProvider({
      apiKey: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(
      p.send({ phone: "+628123456789", code: "1", message: "x" }),
    ).rejects.toBeInstanceOf(OtpDeliveryError);
  });
});
