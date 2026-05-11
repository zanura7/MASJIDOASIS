import { describe, it, expect, vi } from "vitest";
import { NullOtpProvider } from "./null";
import { OtpDeliveryError } from "./types";

describe("NullOtpProvider", () => {
  it("logs the OTP and returns a fake message id", async () => {
    const logger = { info: vi.fn() };
    const p = new NullOtpProvider({ logger });
    const out = await p.send({ phone: "+628123456789", code: "424242", message: "Kode: 424242" });
    expect(logger.info).toHaveBeenCalledOnce();
    expect(out.provider).toBe("null");
    expect(out.providerMessageId).toMatch(/^null-\d+/);
  });

  it("validates phone numbers", async () => {
    const p = new NullOtpProvider({ logger: { info: vi.fn() } });
    await expect(p.send({ phone: "garbage", code: "1", message: "x" })).rejects.toBeInstanceOf(
      OtpDeliveryError,
    );
  });

  it("throws when configured to fail", async () => {
    const p = new NullOtpProvider({ logger: { info: vi.fn() }, failWith: "simulated outage" });
    await expect(
      p.send({ phone: "+628123456789", code: "1", message: "x" }),
    ).rejects.toBeInstanceOf(OtpDeliveryError);
  });
});
