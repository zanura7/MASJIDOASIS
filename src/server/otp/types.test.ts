import { describe, it, expect } from "vitest";
import { assertPhone, toIndonesianMsisdn, OtpDeliveryError } from "./types";

describe("assertPhone", () => {
  it("accepts E.164", () => {
    expect(() => assertPhone("+628123456789")).not.toThrow();
  });
  it("accepts local Indonesian 08...", () => {
    expect(() => assertPhone("08123456789")).not.toThrow();
  });
  it("rejects empty", () => {
    expect(() => assertPhone("")).toThrow(OtpDeliveryError);
  });
  it("rejects letters", () => {
    expect(() => assertPhone("+62abc1234")).toThrow(OtpDeliveryError);
  });
  it("rejects too short", () => {
    expect(() => assertPhone("+6212")).toThrow(OtpDeliveryError);
  });
});

describe("toIndonesianMsisdn", () => {
  it("strips leading + from E.164", () => {
    expect(toIndonesianMsisdn("+628123456789")).toBe("628123456789");
  });
  it("rewrites leading 0 to 62", () => {
    expect(toIndonesianMsisdn("08123456789")).toBe("628123456789");
  });
  it("passes through already-normalised digits", () => {
    expect(toIndonesianMsisdn("628123456789")).toBe("628123456789");
  });
  it("rejects invalid input", () => {
    expect(() => toIndonesianMsisdn("not-a-phone")).toThrow(OtpDeliveryError);
  });
});
