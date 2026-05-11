/**
 * Runtime environment variable validation.
 *
 * Loaded at boot (see scripts/check-env.mjs) and re-used in application code
 * via the exported `env` object. Fails fast with a readable error if any
 * required variable is missing or malformed.
 *
 * No external dependency (avoid pulling zod just for env). Add zod later only
 * if validation needs grow significantly.
 *
 * Reference: docs/env-vars.md
 */

type EnvSpec = {
  /** Variables that MUST be set in every environment. Missing → boot fails. */
  required: readonly string[];
  /** Variables required in production only (allowed empty in dev/test). */
  requiredInProd: readonly string[];
  /** Variables that must parse as URLs when present. */
  urls: readonly string[];
  /** Variables that must be `true` or `false` when present. */
  booleans: readonly string[];
};

const SPEC: EnvSpec = {
  required: [
    "APP_URL",
    "NODE_ENV",
    "DATABASE_URL",
    "REDIS_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "JWT_SECRET",
  ],
  requiredInProd: [
    "BULLMQ_REDIS_URL",
    "OTP_PROVIDER",
    "OTP_API_KEY",
    "MIDTRANS_SERVER_KEY",
    "MIDTRANS_CLIENT_KEY",
    "KIRIMINAJA_API_KEY",
    "WHATSAPP_PROVIDER",
    "WHATSAPP_API_KEY",
    "EMAIL_PROVIDER",
    "EMAIL_API_KEY",
    "STORAGE_DISK",
    "STORAGE_BUCKET",
    "STORAGE_ACCESS_KEY",
    "STORAGE_SECRET_KEY",
  ],
  urls: ["APP_URL", "NEXTAUTH_URL", "DATABASE_URL", "REDIS_URL", "BULLMQ_REDIS_URL"],
  booleans: ["MIDTRANS_IS_PRODUCTION"],
} as const;

export class EnvValidationError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`Environment validation failed:\n  - ${errors.join("\n  - ")}`);
    this.name = "EnvValidationError";
    this.errors = errors;
  }
}

function isUrl(v: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate `process.env` against SPEC. Returns the validated env or throws
 * EnvValidationError. Safe to call multiple times; pure.
 */
export function validateEnv(source: NodeJS.ProcessEnv = process.env): Readonly<Record<string, string>> {
  const errors: string[] = [];
  const isProd = source.NODE_ENV === "production";

  const requiredNow = isProd ? [...SPEC.required, ...SPEC.requiredInProd] : SPEC.required;

  for (const key of requiredNow) {
    const v = source[key];
    if (!v || v.trim() === "") {
      errors.push(`Missing required env: ${key}`);
    }
  }

  for (const key of SPEC.urls) {
    const v = source[key];
    if (v && v.trim() !== "" && !isUrl(v)) {
      errors.push(`Invalid URL in env ${key}: "${v}"`);
    }
  }

  for (const key of SPEC.booleans) {
    const v = source[key];
    if (v !== undefined && v !== "" && v !== "true" && v !== "false") {
      errors.push(`Env ${key} must be "true" or "false" (got: "${v}")`);
    }
  }

  if (errors.length > 0) {
    throw new EnvValidationError(errors);
  }

  // Freeze a shallow copy of the validated subset.
  const out: Record<string, string> = {};
  for (const key of [...SPEC.required, ...SPEC.requiredInProd]) {
    const v = source[key];
    if (v !== undefined) out[key] = v;
  }
  // Pass through optional but-known vars.
  for (const key of ["PRISMA_LOG_LEVEL", "SENTRY_DSN", "STORAGE_ENDPOINT", "STORAGE_REGION"]) {
    const v = source[key];
    if (v !== undefined) out[key] = v;
  }
  return Object.freeze(out);
}

/** Lazily-validated, typed env. Throws on first access if invalid. */
let _cache: Readonly<Record<string, string>> | null = null;
export function getEnv(): Readonly<Record<string, string>> {
  if (_cache) return _cache;
  _cache = validateEnv();
  return _cache;
}

export const ENV_SPEC = SPEC;
