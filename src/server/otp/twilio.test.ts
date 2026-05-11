import { describe, it, expect, vi } from "vitest";
import { TwilioOtpProvider, parseTwilioApiKey } from "./twilio";
import { OtpDeliveryError, OtpConfigurationError } from "./types";

function mockFetch(response: { status?: number; json?: unknown }) {
  return vi.fn(async () => {
    return new Response(JSON.stringify(response.json ?? {}), {
      status: response.status ?? 201,
      headers: { "Content-Type": "application/json" },
    });
  });
}

describe("parseTwilioApiKey", () => {
  it("parses colon-packed key", () => {
    const got = parseTwilioApiKey("AC123:token:+15551234567");
    expect(got).toEqual({ accountSid: "AC123", authToken: "token", fromNumber: "+15551234567" });
  });
  it("rejects wrong segment count", () => {
    expect(() => parseTwilioApiKey("AC123:token")).toThrow(OtpConfigurationError);
  });
  it("rejects empty segment", () => {
    expect(() => parseTwilioApiKey("AC123::+15551234567")).toThrow(OtpConfigurationError);
  });
  it("rejects accountSid not starting with AC", () => {
    expect(() => parseTwilioApiKey("XX123:token:+15551234567")).toThrow(OtpConfigurationError);
  });
});

describe("TwilioOtpProvider", () => {
  it("rejects missing credentials", () => {
    expect(
      () =>
        new TwilioOtpProvider({
          accountSid: "",
          authToken: "t",
          fromNumber: "+1",
        }),
    ).toThrow(OtpConfigurationError);
  });

  it("sends a request with Basic auth and form body", async () => {
    const fetchImpl = mockFetch({ status: 201, json: { sid: "SM999" } });
    const p = new TwilioOtpProvider({
      accountSid: "AC123",
      authToken: "tok",
      fromNumber: "+15551234567",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const res = await p.send({ phone: "+628123456789", code: "1", message: "hi" });
    expect(res.providerMessageId).toBe("SM999");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/Accounts/AC123/Messages.json");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe(`Basic ${Buffer.from("AC123:tok").toString("base64")}`);
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain("To=%2B628123456789");
    expect(body).toContain("From=%2B15551234567");
  });

  it("prepends + when phone has no leading +", async () => {
    const fetchImpl = mockFetch({ json: { sid: "SM1" } });
    const p = new TwilioOtpProvider({
      accountSid: "AC123",
      authToken: "tok",
      fromNumber: "+15551234567",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await p.send({ phone: "628123456789", code: "1", message: "x" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.body as URLSearchParams).toString()).toContain("To=%2B628123456789");
  });

  it("throws OtpDeliveryError when Twilio reports an error code", async () => {
    const fetchImpl = mockFetch({
      status: 400,
      json: { error_code: 21211, error_message: "invalid To" },
    });
    const p = new TwilioOtpProvider({
      accountSid: "AC123",
      authToken: "tok",
      fromNumber: "+15551234567",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(
      p.send({ phone: "+628123456789", code: "1", message: "x" }),
    ).rejects.toBeInstanceOf(OtpDeliveryError);
  });
});
