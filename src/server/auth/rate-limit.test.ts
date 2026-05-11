/**
 * Rate limiter unit tests — MAS-22.
 *
 * Covers: window enforcement, reset behaviour, per-key isolation,
 * remaining/retryAfterMs accounting.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  let now: number;
  const clock = (): number => now;
  let limiter: RateLimiter;

  beforeEach(() => {
    now = 1_000_000;
    limiter = new RateLimiter({ max: 3, windowMs: 1000 }, clock);
  });

  it("allows up to `max` hits within the window", () => {
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(false);
  });

  it("reports remaining count correctly", () => {
    expect(limiter.hit("a").remaining).toBe(2);
    expect(limiter.hit("a").remaining).toBe(1);
    expect(limiter.hit("a").remaining).toBe(0);
    const blocked = limiter.hit("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    limiter.hit("a");
    limiter.hit("a");
    limiter.hit("a");
    expect(limiter.hit("a").allowed).toBe(false);
    now += 1001;
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").remaining).toBe(1);
  });

  it("isolates keys", () => {
    limiter.hit("a");
    limiter.hit("a");
    limiter.hit("a");
    expect(limiter.hit("a").allowed).toBe(false);
    expect(limiter.hit("b").allowed).toBe(true);
    expect(limiter.hit("b").allowed).toBe(true);
  });

  it("reports retryAfterMs decreasing inside the window", () => {
    const first = limiter.hit("a");
    expect(first.retryAfterMs).toBe(1000);
    now += 250;
    const second = limiter.hit("a");
    expect(second.retryAfterMs).toBe(750);
  });

  it("supports manual reset for a key", () => {
    limiter.hit("a");
    limiter.hit("a");
    limiter.hit("a");
    expect(limiter.hit("a").allowed).toBe(false);
    limiter.reset("a");
    expect(limiter.hit("a").allowed).toBe(true);
  });

  it("rejects invalid configs", () => {
    expect(() => new RateLimiter({ max: 0, windowMs: 1 })).toThrow(/max/);
    expect(() => new RateLimiter({ max: 1, windowMs: 0 })).toThrow(/windowMs/);
  });
});
