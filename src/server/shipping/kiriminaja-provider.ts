export class KiriminAjaProviderError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, httpStatus: number, message: string) {
    super(message);
    this.name = "KiriminAjaProviderError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface KiriminAjaConfig {
  apiKey: string;
  baseUrl: string;
  fetchFn?: typeof fetch;
}

export interface KiriminAjaRateInput {
  origin: string; // origin subdistrict id
  destination: string; // destination subdistrict id
  weightGram: number; // weight in grams
  itemValueCents: number; // item value in cents (IDR)
}

export interface KiriminAjaRate {
  service: string; // e.g. "REG", "YES", "BEST"
  courier: string; // e.g. "jne", "sicepat"
  description: string;
  costCents: number; // shipping cost in cents
  etd: string; // estimated time of delivery
}

export class KiriminAjaProvider {
  private apiKey: string;
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(config: KiriminAjaConfig) {
    if (!config.apiKey || config.apiKey.trim() === "") {
      throw new KiriminAjaProviderError("MISSING_API_KEY", 500, "KiriminAja API key is required");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, ""); // Trim trailing slashes
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async getRates(input: KiriminAjaRateInput): Promise<KiriminAjaRate[]> {
    const url = `${this.baseUrl}/shipping_price`;
    
    // KiriminAja API expects integer values (not cents)
    const payload = {
      origin: input.origin,
      destination: input.destination,
      weight: input.weightGram,
      item_value: Math.floor(input.itemValueCents / 100),
    };

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new KiriminAjaProviderError(
        "NETWORK_ERROR",
        502,
        `Failed to reach KiriminAja API: ${(err as Error).message}`
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new KiriminAjaProviderError(
        "PROVIDER_HTTP_ERROR",
        502, // We return 502 Bad Gateway when upstream fails
        `KiriminAja API returned ${response.status}: ${text}`
      );
    }

    const data = await response.json().catch(() => null);
    if (!data || data.status !== true || !Array.isArray(data.data)) {
      throw new KiriminAjaProviderError(
        "INVALID_RESPONSE",
        502,
        "KiriminAja API returned invalid format"
      );
    }

    return data.data.map((rate: any) => ({
      service: rate.service,
      courier: rate.courier,
      description: rate.description,
      // KiriminAja returns Rupiah integers, we need to convert to cents
      costCents: rate.cost * 100,
      etd: rate.etd,
    }));
  }
}
