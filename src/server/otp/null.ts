/**
 * Null / log-only OTP adapter — MAS-21.
 *
 * Used in development and tests when no real provider is configured. Writes
 * the OTP to the server log instead of sending it anywhere. Never use in
 * production — `getOtpProvider()` refuses to return this when
 * NODE_ENV=production.
 */

import {
  OtpDeliveryError,
  assertPhone,
  type OtpProvider,
  type OtpSendInput,
  type OtpSendResult,
} from "./types";

export interface NullOtpConfig {
  /** Injectable logger for tests. */
  logger?: Pick<Console, "info">;
  /**
   * If set, throw on send — useful in tests that assert error handling.
   */
  failWith?: string;
}

export class NullOtpProvider implements OtpProvider {
  readonly name = "null";
  readonly channel = "whatsapp" as const;
  private readonly logger: Pick<Console, "info">;
  private readonly failWith?: string;

  constructor(cfg: NullOtpConfig = {}) {
    this.logger = cfg.logger ?? console;
    this.failWith = cfg.failWith;
  }

  async send(input: OtpSendInput): Promise<OtpSendResult> {
    assertPhone(input.phone);
    if (this.failWith) {
      throw new OtpDeliveryError(this.name, this.failWith);
    }
    this.logger.info(
      `[otp:null] phone=${input.phone} code=${input.code} message=${JSON.stringify(input.message)}`,
    );
    return {
      provider: this.name,
      channel: this.channel,
      providerMessageId: `null-${Date.now()}`,
    };
  }
}
