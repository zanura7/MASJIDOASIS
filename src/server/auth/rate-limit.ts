/**
 * In-memory rate limiter — MAS-22.
 *
 * Sliding-window-ish token bucket keyed by an arbitrary string (phone, IP,
 * `phone:ip`). Used by the OTP endpoints to defend against:
 *   - Burst abuse on `POST /auth/request-otp` (provider $$ + SMS spam).
 *   - Brute force on `POST /auth/verify-otp` (in addition to the per-OTP
 *     attempt counter persisted in the DB).
 *
 * Limitations (and migration plan):
 *   - In-memory only. Does NOT survive a server restart or scale across
 *     replicas. Acceptable for MVP single-instance deploy.
 *   - Production scale-out MUST migrate to Redis (`INCR` + `EXPIRE`).
 *     Track in MAS-23 (session/middleware ticket).
 *
 * Algorithm: simple fixed-window counter — reset when `windowMs` passes
 * since the bucket's first hit. Good enough for human-scale abuse and
 * avoids the complexity of a leaky bucket for the MVP.
 */

export interface RateLimitConfig {
  /** Max hits allowed per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  /** True if the hit was allowed (i.e. count <= max). */
  allowed: boolean;
  /** Hits remaining in this window after this call. */
  remaining: number;
  /** ms until the window resets. */
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly config: RateLimitConfig;
  private readonly clock: () => number;

  constructor(config: RateLimitConfig, clock: () => number = Date.now) {
    if (config.max < 1) throw new Error("RateLimiter: max must be >= 1");
    if (config.windowMs < 1) throw new Error("RateLimiter: windowMs must be >= 1");
    this.config = config;
    this.clock = clock;
  }

  hit(key: string): RateLimitResult {
    const now = this.clock();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const bucket: Bucket = { count: 1, resetAt: now + this.config.windowMs };
      this.buckets.set(key, bucket);
      return {
        allowed: true,
        remaining: this.config.max - 1,
        retryAfterMs: this.config.windowMs,
      };
    }

    existing.count += 1;
    const allowed = existing.count <= this.config.max;
    return {
      allowed,
      remaining: Math.max(0, this.config.max - existing.count),
      retryAfterMs: existing.resetAt - now,
    };
  }

  /** Force-reset a key. Useful in tests; rarely needed at runtime. */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Drop all keys. Used by tests. */
  clear(): void {
    this.buckets.clear();
  }

  /** Read-only snapshot of current state. Diagnostic only. */
  size(): number {
    return this.buckets.size;
  }
}

/**
 * Module-level limiters used by the OTP routes. Exported so tests can
 * reset them between cases.
 *
 * Limits chosen per ADR-001 §Auth:
 *   - Request OTP:  5 per 10 minutes per phone, 20 per hour per IP.
 *   - Verify OTP:   10 per 5 minutes per phone (DB also caps at 5 attempts
 *                   per code, this is the broader floor).
 */
export const requestOtpPhoneLimiter = new RateLimiter({ max: 5, windowMs: 10 * 60_000 });
export const requestOtpIpLimiter = new RateLimiter({ max: 20, windowMs: 60 * 60_000 });
export const verifyOtpPhoneLimiter = new RateLimiter({ max: 10, windowMs: 5 * 60_000 });
