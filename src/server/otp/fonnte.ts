/**
 * Fonnte WhatsApp OTP adapter — MAS-21.
 *
 * Fonnte is an Indonesian WhatsApp Business API gateway. Docs:
 *   https://docs.fonnte.com/send-message/
 *
 * Endpoint: POST https://api.fonnte.com/send
 *   Headers: Authorization: <device token>
 *   Body (form-encoded):
 *     target=<msisdn>          // "62812..." digits-only, no leading "+"
 *     message=<text>
 *     countryCode=62           // optional, normalised by us anyway
 *
 * Response (200 JSON): { status: true, id: ["..."], target: ["..."], ... }
 * Failure response still returns HTTP 200 with { status: false, reason: "..." }
 * so we MUST inspect the JSON body, not just the status code.
 */

import {
  OtpDeliveryError,
  OtpConfigurationError,
  type OtpProvider,
  type OtpSendInput,
  type OtpSendResult,
  toIndonesianMsisdn,
} from "./types";

export interface FonnteConfig {
  /** Device token (Fonnte's per-device API key). Required. */
  apiKey: string;
  /** Override for tests; defaults to the production endpoint. */
  endpoint?: string;
  /** Injectable fetch for tests. Defaults to global fetch (Node 22+ / Next). */
  fetchImpl?: typeof fetch;
}

interface FonnteResponse {
  status?: boolean;
  reason?: string;
  id?: string[];
  detail?: string;
}

const DEFAULT_ENDPOINT = "https://api.fonnte.com/send";

export class FonnteOtpProvider implements OtpProvider {
  readonly name = "fonnte";
  readonly channel = "whatsapp" as const;

  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: FonnteConfig) {
    if (!cfg.apiKey || cfg.apiKey.trim() === "") {
      throw new OtpConfigurationError("fonnte: apiKey is required");
    }
    this.apiKey = cfg.apiKey;
    this.endpoint = cfg.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") {
      throw new OtpConfigurationError("fonnte: global fetch unavailable; pass fetchImpl");
    }
  }

  async send(input: OtpSendInput): Promise<OtpSendResult> {
    const target = toIndonesianMsisdn(input.phone);

    const body = new URLSearchParams({
      target,
      message: input.message,
      countryCode: "62",
    });

    let res: Response;
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
    } catch (err) {
      throw new OtpDeliveryError(this.name, "network error calling Fonnte", { cause: err });
    }

    let parsed: FonnteResponse;
    try {
      parsed = (await res.json()) as FonnteResponse;
    } catch (err) {
      throw new OtpDeliveryError(this.name, `non-JSON response (HTTP ${res.status})`, {
        cause: err,
        status: res.status,
      });
    }

    if (!res.ok) {
      throw new OtpDeliveryError(this.name, `HTTP ${res.status}: ${parsed.reason ?? parsed.detail ?? "unknown"}`, {
        status: res.status,
      });
    }

    if (parsed.status !== true) {
      throw new OtpDeliveryError(this.name, `provider rejected: ${parsed.reason ?? "unknown"}`, {
        status: res.status,
      });
    }

    return {
      provider: this.name,
      channel: this.channel,
      providerMessageId: parsed.id?.[0],
    };
  }
}
