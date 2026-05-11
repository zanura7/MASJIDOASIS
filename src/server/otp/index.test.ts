import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildOtpProvider,
  getOtpProvider,
  _resetOtpProviderCacheForTests,
  renderOtpMessage,
  OtpConfigurationError,
} from "./index";

beforeEach(() => {
  _resetOtpProviderCacheForTests();
});

describe("buildOtpProvider", () => {
  it("returns NullOtpProvider when OTP_PROVIDER is unset in dev", () => {
    const p = buildOtpProvider({ env: { NODE_ENV: "development" } });
    expect(p.name).toBe("null");
  });

  it("returns FonnteOtpProvider for OTP_PROVIDER=fonnte", () => {
    const p = buildOtpProvider({
      env: { NODE_ENV: "development", OTP_PROVIDER: "fonnte", OTP_API_KEY: "k" },
    });
    expect(p.name).toBe("fonnte");
    expect(p.channel).toBe("whatsapp");
  });

  it("returns TwilioOtpProvider for OTP_PROVIDER=twilio", () => {
    const p = buildOtpProvider({
      env: {
        NODE_ENV: "development",
        OTP_PROVIDER: "twilio",
        OTP_API_KEY: "AC123:tok:+15551234567",
      },
    });
    expect(p.name).toBe("twilio");
    expect(p.channel).toBe("sms");
  });

  it("refuses null provider in production", () => {
    expect(() => buildOtpProvider({ env: { NODE_ENV: "production" } })).toThrow(
      OtpConfigurationError,
    );
  });

  it("requires OTP_API_KEY for fonnte", () => {
    expect(() =>
      buildOtpProvider({ env: { NODE_ENV: "development", OTP_PROVIDER: "fonnte" } }),
    ).toThrow(OtpConfigurationError);
  });

  it("rejects unknown providers", () => {
    expect(() =>
      buildOtpProvider({
        env: { NODE_ENV: "development", OTP_PROVIDER: "carrier-pigeon", OTP_API_KEY: "x" },
      }),
    ).toThrow(OtpConfigurationError);
  });

  it("explicitly errors on wablas (not yet implemented)", () => {
    expect(() =>
      buildOtpProvider({
        env: { NODE_ENV: "development", OTP_PROVIDER: "wablas", OTP_API_KEY: "x" },
      }),
    ).toThrow(/wablas/);
  });
});

describe("getOtpProvider", () => {
  it("caches the instance across calls", () => {
    const a = getOtpProvider();
    const b = getOtpProvider();
    expect(a).toBe(b);
  });
});

describe("renderOtpMessage", () => {
  it("includes the code and app name", () => {
    const msg = renderOtpMessage("123456");
    expect(msg).toContain("123456");
    expect(msg).toContain("MasjidOasis");
  });

  it("accepts a custom app name", () => {
    const msg = renderOtpMessage("123456", "TestApp");
    expect(msg).toContain("TestApp");
  });
});
