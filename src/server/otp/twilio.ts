/**
 * Twilio SMS OTP adapter — MAS-21.
 *
 * Uses the plain Messages REST API (NOT Verify) so the caller stays in
 * control of OTP generation and storage. Docs:
 *   https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource
 *
 * Endpoint:
 *   POST https://api.twilio.com/2010-04-01/Accounts/<sid>/Messages.json
 *   Auth: HTTP Basic — username=<accountSid>, password=<authToken>
 *   Body (form-encoded): To=<E.164>&From=<E.164>&Body=<text>
 *
 * Configuration via env (read by getOtpProvider in ./index.ts):
 *   OTP_PROVIDER=twilio
 *   OTP_API_KEY=<accountSid>:<authToken>:<fromNumber>
 *
 * The triple-encoded key format keeps the env surface flat (one variable)
 * while still carrying all three required fields. Validation happens in the
 * constructor.
 */

import {
  OtpDeliveryError,
  OtpConfigurationError,
  type OtpProvider,
  type OtpSendInput,
  type OtpSendResult,
  assertPhone,
} from "./types";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

interface TwilioResponse {
  sid?: string;
  status?: string;
  error_code?: number | null;
  error_message?: string | null;
  message?: string;
}

function defaultEndpoint(sid: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
}

/** Parse the colon-packed OTP_API_KEY format. */
export function parseTwilioApiKey(raw: string): { accountSid: string; authToken: string; fromNumber: string } {
  const parts = raw.split(":");
  if (parts.length !== 3 || parts.some((p) => p.trim() === "")) {
    throw new OtpConfigurationError(
      "twilio: OTP_API_KEY must be '<accountSid>:<authToken>:<fromNumber>'",
    );
  }
  const [accountSid, authToken, fromNumber] = parts;
  if (!accountSid.startsWith("AC")) {
    throw new OtpConfigurationError("twilio: accountSid must start with 'AC'");
  }
  return { accountSid, authToken, fromNumber };
}

export class TwilioOtpProvider implements OtpProvider {
  readonly name = "twilio";
  readonly channel = "sms" as const;

  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: TwilioConfig) {
    if (!cfg.accountSid || !cfg.authToken || !cfg.fromNumber) {
      throw new OtpConfigurationError("twilio: accountSid/authToken/fromNumber are required");
    }
    this.accountSid = cfg.accountSid;
    this.authToken = cfg.authToken;
    this.fromNumber = cfg.fromNumber;
    this.endpoint = cfg.endpoint ?? defaultEndpoint(cfg.accountSid);
    this.fetchImpl = cfg.fetchImpl ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") {
      throw new OtpConfigurationError("twilio: global fetch unavailable; pass fetchImpl");
    }
  }

  async send(input: OtpSendInput): Promise<OtpSendResult> {
    assertPhone(input.phone);

    const body = new URLSearchParams({
      To: input.phone.startsWith("+") ? input.phone : `+${input.phone}`,
      From: this.fromNumber,
      Body: input.message,
    });

    const basic = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    let res: Response;
    try {
      res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
    } catch (err) {
      throw new OtpDeliveryError(this.name, "network error calling Twilio", { cause: err });
    }

    let parsed: TwilioResponse;
    try {
      parsed = (await res.json()) as TwilioResponse;
    } catch (err) {
      throw new OtpDeliveryError(this.name, `non-JSON response (HTTP ${res.status})`, {
        cause: err,
        status: res.status,
      });
    }

    if (!res.ok || parsed.error_code) {
      const reason = parsed.error_message ?? parsed.message ?? `HTTP ${res.status}`;
      throw new OtpDeliveryError(this.name, reason, { status: res.status });
    }

    return {
      provider: this.name,
      channel: this.channel,
      providerMessageId: parsed.sid,
    };
  }
}
