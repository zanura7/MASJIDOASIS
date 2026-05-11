/**
 * ShippingQuoter — MAS-33.
 *
 * KiriminAja shipping cost estimator. The real KiriminAja API integration
 * lives in a separate ticket; this module provides a deterministic
 * cost calculator with the SAME shape as the eventual response so
 * checkout code doesn't need to change later.
 *
 * Rate card (Indonesian retail, IDR cents):
 *   - Base: 9_000 IDR per shipment
 *   - +2_000 IDR per kg (rounded up to next kg, min 1kg)
 *
 * Services exposed by the stub: REG (regular), SAME_DAY.
 * SAME_DAY multiplier: 2.5×, only available for orders ≤ 5kg.
 */

export type ShippingService = "REG" | "SAME_DAY";

export interface ShippingAddress {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postalCode: string;
  country: string; // ISO-3166-1 alpha-2, e.g. "ID"
}

export interface ShippingQuoteInput {
  service: ShippingService;
  totalWeightGram: number;
  destination: ShippingAddress;
}

export interface ShippingQuote {
  service: ShippingService;
  costCents: number;
  currency: string;
  etaDays: number;
  provider: "kiriminaja";
}

export interface ShippingQuoter {
  quote(input: ShippingQuoteInput): ShippingQuote;
}

const BASE_CENTS = 900_000; // 9_000 IDR in cents
const PER_KG_CENTS = 200_000; // 2_000 IDR in cents
const SAME_DAY_MULTIPLIER = 2.5;
const SAME_DAY_MAX_GRAM = 5_000;

export class ShippingQuoteError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "ShippingQuoteError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function ceilKg(grams: number): number {
  if (grams <= 0) return 1;
  return Math.max(1, Math.ceil(grams / 1000));
}

export function validateAddress(addr: unknown): ShippingAddress {
  if (!addr || typeof addr !== "object") {
    throw new ShippingQuoteError("BAD_ADDRESS", 400, "address is required");
  }
  const a = addr as Record<string, unknown>;
  const required: Array<keyof ShippingAddress> = [
    "recipientName",
    "phone",
    "line1",
    "city",
    "province",
    "postalCode",
    "country",
  ];
  for (const k of required) {
    if (typeof a[k] !== "string" || (a[k] as string).trim() === "") {
      throw new ShippingQuoteError("BAD_ADDRESS", 400, `address.${k} is required`);
    }
  }
  if ((a.country as string).length !== 2) {
    throw new ShippingQuoteError(
      "BAD_ADDRESS",
      400,
      "address.country must be ISO-3166-1 alpha-2 (e.g. ID)",
    );
  }
  return {
    recipientName: (a.recipientName as string).trim(),
    phone: (a.phone as string).trim(),
    line1: (a.line1 as string).trim(),
    line2: typeof a.line2 === "string" ? a.line2.trim() : undefined,
    city: (a.city as string).trim(),
    province: (a.province as string).trim(),
    postalCode: (a.postalCode as string).trim(),
    country: (a.country as string).trim().toUpperCase(),
  };
}

export class KiriminAjaStubQuoter implements ShippingQuoter {
  quote(input: ShippingQuoteInput): ShippingQuote {
    if (
      typeof input.totalWeightGram !== "number" ||
      !Number.isFinite(input.totalWeightGram) ||
      input.totalWeightGram < 0
    ) {
      throw new ShippingQuoteError(
        "BAD_WEIGHT",
        400,
        "totalWeightGram must be a non-negative finite number",
      );
    }
    const kg = ceilKg(input.totalWeightGram);
    let cents = BASE_CENTS + kg * PER_KG_CENTS;
    let etaDays = 3;
    if (input.service === "SAME_DAY") {
      if (input.totalWeightGram > SAME_DAY_MAX_GRAM) {
        throw new ShippingQuoteError(
          "SERVICE_UNAVAILABLE",
          409,
          `SAME_DAY unavailable for shipments > ${SAME_DAY_MAX_GRAM}g`,
        );
      }
      cents = Math.round(cents * SAME_DAY_MULTIPLIER);
      etaDays = 0;
    } else if (input.service !== "REG") {
      throw new ShippingQuoteError(
        "BAD_SERVICE",
        400,
        "service must be REG or SAME_DAY",
      );
    }
    return {
      service: input.service,
      costCents: cents,
      currency: "IDR",
      etaDays,
      provider: "kiriminaja",
    };
  }
}

export const defaultShippingQuoter: ShippingQuoter = new KiriminAjaStubQuoter();
