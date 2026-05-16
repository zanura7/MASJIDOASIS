import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  checkMidtransNotificationSignature,
  computeMidtransSignature,
  verifyMidtransSignature,
} from "./signature";

const SERVER_KEY = "SB-Mid-server-XXXXXXXXXXXX";

function sha512Hex(s: string): string {
  return createHash("sha512").update(s, "utf8").digest("hex");
}

describe("computeMidtransSignature", () => {
  it("matches the Midtrans spec formula SHA512(order_id+status_code+gross_amount+server_key)", () => {
    const orderId = "order-001";
    const statusCode = "200";
    const grossAmount = "10000.00";
    const expected = sha512Hex(orderId + statusCode + grossAmount + SERVER_KEY);
    expect(
      computeMidtransSignature({
        orderId,
        statusCode,
        grossAmount,
        serverKey: SERVER_KEY,
      }),
    ).toBe(expected);
  });

  it("is sensitive to every input — flipping any single field changes the digest", () => {
    const base = {
      orderId: "order-001",
      statusCode: "200",
      grossAmount: "10000.00",
      serverKey: SERVER_KEY,
    };
    const original = computeMidtransSignature(base);

    expect(
      computeMidtransSignature({ ...base, orderId: "order-002" }),
    ).not.toBe(original);
    expect(computeMidtransSignature({ ...base, statusCode: "201" })).not.toBe(
      original,
    );
    expect(
      computeMidtransSignature({ ...base, grossAmount: "10000.01" }),
    ).not.toBe(original);
    expect(
      computeMidtransSignature({ ...base, serverKey: "different-key" }),
    ).not.toBe(original);
  });

  it("produces a 128-char hex digest", () => {
    const sig = computeMidtransSignature({
      orderId: "x",
      statusCode: "y",
      grossAmount: "z",
      serverKey: "k",
    });
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
  });
});

describe("verifyMidtransSignature", () => {
  const expected = sha512Hex("abc");

  it("returns true on exact match", () => {
    expect(verifyMidtransSignature(expected, expected)).toBe(true);
  });

  it("returns false on mismatch", () => {
    const other = sha512Hex("xyz");
    expect(verifyMidtransSignature(other, expected)).toBe(false);
  });

  it("returns false on empty received signature", () => {
    expect(verifyMidtransSignature("", expected)).toBe(false);
  });

  it("returns false on length mismatch (does not throw)", () => {
    expect(verifyMidtransSignature("short", expected)).toBe(false);
    expect(verifyMidtransSignature(expected + "x", expected)).toBe(false);
  });

  it("returns false for non-string input (defensive)", () => {
    // Casting via unknown to test the defensive branch.
    expect(
      verifyMidtransSignature(
        null as unknown as string,
        expected,
      ),
    ).toBe(false);
    expect(
      verifyMidtransSignature(
        undefined as unknown as string,
        expected,
      ),
    ).toBe(false);
  });
});

describe("checkMidtransNotificationSignature", () => {
  it("returns ok:true when body.signature_key matches the recomputed digest", () => {
    const body = {
      order_id: "order-001",
      status_code: "200",
      gross_amount: "10000.00",
      signature_key: sha512Hex("order-001" + "200" + "10000.00" + SERVER_KEY),
    };
    const result = checkMidtransNotificationSignature(body, SERVER_KEY);
    expect(result.ok).toBe(true);
  });

  it("returns ok:false with expected+received when signature mismatches", () => {
    const body = {
      order_id: "order-001",
      status_code: "200",
      gross_amount: "10000.00",
      signature_key: sha512Hex("forged"),
    };
    const result = checkMidtransNotificationSignature(body, SERVER_KEY);
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.received).toBe(body.signature_key);
      expect(result.expected).toBe(
        sha512Hex("order-001" + "200" + "10000.00" + SERVER_KEY),
      );
    }
  });

  it("returns ok:false when an attacker tampers with gross_amount", () => {
    const originalGross = "10000.00";
    const tamperedGross = "1.00";
    const realSig = sha512Hex(
      "order-001" + "200" + originalGross + SERVER_KEY,
    );
    const body = {
      order_id: "order-001",
      status_code: "200",
      gross_amount: tamperedGross,
      // attacker keeps the legit signature, hoping we don't recompute
      signature_key: realSig,
    };
    const result = checkMidtransNotificationSignature(body, SERVER_KEY);
    expect(result.ok).toBe(false);
  });
});
