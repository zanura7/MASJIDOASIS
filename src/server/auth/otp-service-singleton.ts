/**
 * Singleton OtpService for the API routes — MAS-22.
 *
 * Wires the configured OTP provider (MAS-21) with the env-derived pepper
 * and exposes a memoised accessor. Test code should construct `OtpService`
 * directly rather than going through here so each test can inject its own
 * provider/clock.
 */

import { getOtpProvider } from "@/server/otp";
import { OtpService } from "./otp-service";

let _instance: OtpService | null = null;

export function getOtpService(): OtpService {
  if (_instance) return _instance;
  const pepper = process.env.JWT_SECRET;
  if (!pepper || pepper.length < 16) {
    throw new Error("JWT_SECRET must be set (>= 16 chars) before using OtpService");
  }
  _instance = new OtpService({ provider: getOtpProvider(), pepper });
  return _instance;
}

/** Test helper — drops the cache so the next call re-reads env/provider. */
export function _resetOtpServiceCacheForTests(): void {
  _instance = null;
}
