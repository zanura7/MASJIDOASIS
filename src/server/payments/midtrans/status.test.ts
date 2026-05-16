import { describe, expect, it } from "vitest";

import { mapMidtransOutcome } from "./status";

describe("mapMidtransOutcome", () => {
  it("settlement → PAID", () => {
    expect(mapMidtransOutcome({ transaction_status: "settlement" })).toBe(
      "PAID",
    );
  });

  it("capture + fraud_status=accept → PAID", () => {
    expect(
      mapMidtransOutcome({
        transaction_status: "capture",
        fraud_status: "accept",
      }),
    ).toBe("PAID");
  });

  it("capture + fraud_status=challenge → PENDING (manual review)", () => {
    expect(
      mapMidtransOutcome({
        transaction_status: "capture",
        fraud_status: "challenge",
      }),
    ).toBe("PENDING");
  });

  it("capture + fraud_status=deny → FAILED", () => {
    expect(
      mapMidtransOutcome({
        transaction_status: "capture",
        fraud_status: "deny",
      }),
    ).toBe("FAILED");
  });

  it("capture without fraud_status → PENDING (safer default)", () => {
    expect(mapMidtransOutcome({ transaction_status: "capture" })).toBe(
      "PENDING",
    );
  });

  it.each(["deny", "cancel", "expire", "failure", "refund", "chargeback"])(
    "%s → FAILED",
    (status) => {
      expect(mapMidtransOutcome({ transaction_status: status })).toBe("FAILED");
    },
  );

  it.each(["pending", "authorize"])("%s → PENDING", (status) => {
    expect(mapMidtransOutcome({ transaction_status: status })).toBe("PENDING");
  });

  it("unknown status defaults to PENDING (safer than PAID/FAILED)", () => {
    expect(
      mapMidtransOutcome({ transaction_status: "totally-made-up" }),
    ).toBe("PENDING");
  });

  it("is case-insensitive on transaction_status", () => {
    expect(mapMidtransOutcome({ transaction_status: "SETTLEMENT" })).toBe(
      "PAID",
    );
    expect(mapMidtransOutcome({ transaction_status: "Capture", fraud_status: "Accept" })).toBe("PAID");
  });
});
