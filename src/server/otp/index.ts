/**
 * OTP provider factory — MAS-21.
 *
 * Resolves the concrete `OtpProvider` instance from environment variables.
 * Caches the result so callers can `import { getOtpProvider } from "@/server/otp"`
 * freely without paying construction cost per request.
 *
 * Supported providers (matrix in ADR-001 §Auth):
 *   fonnte  — Fonnte WhatsApp gateway (default, Indonesia).
 *   wablas  — Wablas WhatsApp gateway. NOT YET IMPLEMENTED — falls back to
 *             a hard configuration error so we don't silently route to the
 *             wrong API. Add `wablas.ts` and wire it here when needed.
 *   twilio  — Twilio Messages (SMS). For international fallback.
 *   null    — Logs OTP to stdout. Dev/test only; refused in production.
 *
 * Env contract (validated in src/lib/env.ts, MAS-19):
 *   OTP_PROVIDER  one of the keys above.
 *   OTP_API_KEY   provider-specific credential. For Twilio the format is
 *                 "<accountSid>:<authToken>:<fromNumber>".
 */

import { FonnteOtpProvider } from "./fonnte";
import { NullOtpProvider } from "./null";
import { TwilioOtpProvider, parseTwilioApiKey } from "./twilio";
import { OtpConfigurationError, type OtpProvider } from "./types";

export type { OtpProvider, OtpSendInput, OtpSendResult, OtpChannel } from "./types";
export { OtpDeliveryError, OtpConfigurationError } from "./types";

let _cached: OtpProvider | null = null;

interface BuildOpts {
  /** Override env source — used by tests. */
  env?: NodeJS.ProcessEnv;
  /** Inject fetch — used by tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Build a provider from explicit options. Pure factory; does not cache.
 * Prefer `getOtpProvider()` in application code.
 */
export function buildOtpProvider(opts: BuildOpts = {}): OtpProvider {
  const env = opts.env ?? process.env;
  const providerKey = (env.OTP_PROVIDER ?? "").trim().toLowerCase();
  const apiKey = (env.OTP_API_KEY ?? "").trim();
  const nodeEnv = (env.NODE_ENV ?? "development").trim();
  const isProd = nodeEnv === "production";

  // Empty / unset → null provider in non-prod, hard error in prod.
  if (providerKey === "" || providerKey === "null") {
    if (isProd) {
      throw new OtpConfigurationError(
        "OTP_PROVIDER is unset in production; refusing to use the null/log adapter",
      );
    }
    return new NullOtpProvider();
  }

  switch (providerKey) {
    case "fonnte":
      if (!apiKey) throw new OtpConfigurationError("fonnte: OTP_API_KEY is required");
      return new FonnteOtpProvider({ apiKey, fetchImpl: opts.fetchImpl });

    case "wablas":
      // TODO(MAS-21+): implement Wablas adapter when first real account exists.
      throw new OtpConfigurationError(
        "wablas adapter not implemented yet; set OTP_PROVIDER=fonnte or twilio",
      );

    case "twilio": {
      if (!apiKey) throw new OtpConfigurationError("twilio: OTP_API_KEY is required");
      const parsed = parseTwilioApiKey(apiKey);
      return new TwilioOtpProvider({ ...parsed, fetchImpl: opts.fetchImpl });
    }

    default:
      throw new OtpConfigurationError(`unknown OTP_PROVIDER: "${providerKey}"`);
  }
}

/** Cached app-level accessor. Throws on first call if env is invalid. */
export function getOtpProvider(): OtpProvider {
  if (_cached) return _cached;
  _cached = buildOtpProvider();
  return _cached;
}

/** Test helper — drops the cache so the next `getOtpProvider()` re-reads env. */
export function _resetOtpProviderCacheForTests(): void {
  _cached = null;
}

/**
 * Render the user-facing OTP message. Centralised so every adapter sends the
 * same wording (the auth module passes its rendered output through `send`).
 */
export function renderOtpMessage(code: string, appName = "MasjidOasis"): string {
  return `Kode verifikasi ${appName} Anda: ${code}. Jangan bagikan kode ini ke siapa pun. Berlaku 5 menit.`;
}
