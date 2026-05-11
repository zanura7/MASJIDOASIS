import { describe, it, expect } from "vitest";

/**
 * Cross-cutting sanity test — proves the test runner itself is wired correctly.
 * Lives under `tests/` (not `src/`) so it doesn't count toward source coverage.
 */
describe("vitest wiring", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });

  it("supports async", async () => {
    const v = await Promise.resolve("ok");
    expect(v).toBe("ok");
  });
});
