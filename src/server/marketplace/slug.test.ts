import { describe, it, expect } from "vitest";

import { slugify, withRandomSuffix } from "./slug";

describe("slugify", () => {
  it("lowercases + dashes", () => {
    expect(slugify("Kurma Ajwa 1kg")).toBe("kurma-ajwa-1kg");
  });
  it("strips diacritics", () => {
    expect(slugify("Café Arabíca")).toBe("cafe-arabica");
  });
  it("collapses runs of non-alnum", () => {
    expect(slugify("hello   world!!!")).toBe("hello-world");
  });
  it("trims leading/trailing dashes", () => {
    expect(slugify("  --foo-- ")).toBe("foo");
  });
  it("caps at 80 chars", () => {
    const long = "a".repeat(120);
    expect(slugify(long).length).toBe(80);
  });
  it("throws on empty/all-symbol input", () => {
    expect(() => slugify("")).toThrow();
    expect(() => slugify("!!!")).toThrow();
    expect(() => slugify("   ")).toThrow();
  });
});

describe("withRandomSuffix", () => {
  it("appends a deterministic suffix when rng is seeded", () => {
    let i = 0;
    const rng = () => {
      const arr = [0.1, 0.2, 0.3, 0.4, 0.5];
      const v = arr[i % arr.length] ?? 0;
      i++;
      return v;
    };
    const out = withRandomSuffix("kurma-ajwa-1kg", 5, rng);
    expect(out.startsWith("kurma-ajwa-1kg-")).toBe(true);
    expect(out.length).toBe("kurma-ajwa-1kg-".length + 5);
  });
  it("trims slug so total ≤ 80 chars", () => {
    const long = "a".repeat(80);
    const out = withRandomSuffix(long, 5);
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.split("-").pop()?.length).toBe(5);
  });
});
