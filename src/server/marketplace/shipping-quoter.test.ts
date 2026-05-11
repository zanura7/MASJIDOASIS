import { describe, it, expect } from "vitest";

import {
  KiriminAjaStubQuoter,
  defaultShippingQuoter,
  validateAddress,
  ShippingQuoteError,
  type ShippingAddress,
} from "./shipping-quoter";

const dest: ShippingAddress = {
  recipientName: "Buyer",
  phone: "08123456789",
  line1: "Jl Mawar 1",
  city: "Jakarta",
  province: "DKI Jakarta",
  postalCode: "12345",
  country: "ID",
};

describe("KiriminAjaStubQuoter", () => {
  const q = new KiriminAjaStubQuoter();

  it("returns REG cost with 1kg-rounded weight", () => {
    const r = q.quote({ service: "REG", totalWeightGram: 100, destination: dest });
    // base 900000 + 1kg * 200000 = 1_100_000 cents
    expect(r.costCents).toBe(1_100_000);
    expect(r.currency).toBe("IDR");
    expect(r.provider).toBe("kiriminaja");
    expect(r.etaDays).toBe(3);
  });

  it("scales by next-kg bucket", () => {
    const a = q.quote({ service: "REG", totalWeightGram: 1_000, destination: dest });
    const b = q.quote({ service: "REG", totalWeightGram: 1_001, destination: dest });
    // a: 1kg -> base + 1*per_kg; b: 2kg -> base + 2*per_kg
    expect(b.costCents - a.costCents).toBe(200_000);
  });

  it("SAME_DAY costs more than REG and has 0 eta", () => {
    const reg = q.quote({ service: "REG", totalWeightGram: 500, destination: dest });
    const sd = q.quote({ service: "SAME_DAY", totalWeightGram: 500, destination: dest });
    expect(sd.costCents).toBeGreaterThan(reg.costCents);
    expect(sd.etaDays).toBe(0);
  });

  it("SAME_DAY rejected over 5kg", () => {
    expect(() =>
      q.quote({ service: "SAME_DAY", totalWeightGram: 5_001, destination: dest }),
    ).toThrowError(ShippingQuoteError);
  });

  it("rejects negative weight", () => {
    expect(() =>
      q.quote({ service: "REG", totalWeightGram: -1, destination: dest }),
    ).toThrowError(ShippingQuoteError);
  });

  it("rejects unknown service", () => {
    expect(() =>
      q.quote({
        service: "ROCKET" as unknown as "REG",
        totalWeightGram: 100,
        destination: dest,
      }),
    ).toThrowError(ShippingQuoteError);
  });

  it("defaultShippingQuoter is exported and usable", () => {
    const r = defaultShippingQuoter.quote({
      service: "REG",
      totalWeightGram: 100,
      destination: dest,
    });
    expect(r.costCents).toBeGreaterThan(0);
  });

  it("ShippingQuoteError carries code + status", () => {
    const e = new ShippingQuoteError("BAD_SERVICE", 400, "x");
    expect(e.code).toBe("BAD_SERVICE");
    expect(e.httpStatus).toBe(400);
  });
});

describe("validateAddress", () => {
  it("returns trimmed fields", () => {
    const a = validateAddress({ ...dest, recipientName: "  Buyer  " });
    expect(a.recipientName).toBe("Buyer");
    expect(a.country).toBe("ID");
  });

  it("rejects missing field", () => {
    expect(() => validateAddress({ ...dest, postalCode: "" })).toThrowError(
      ShippingQuoteError,
    );
  });

  it("rejects bad country code", () => {
    expect(() => validateAddress({ ...dest, country: "IDN" })).toThrowError(
      ShippingQuoteError,
    );
  });

  it("rejects non-object", () => {
    expect(() => validateAddress(null)).toThrowError(ShippingQuoteError);
  });
});
