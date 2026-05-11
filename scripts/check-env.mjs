#!/usr/bin/env node
/**
 * Boot-time environment variable check.
 *
 * Usage:
 *   node scripts/check-env.mjs              # validate current process.env
 *   NODE_ENV=production node scripts/check-env.mjs  # validate prod-mode requirements
 *
 * Intended to be wired into npm scripts (e.g. predev / prestart) and CI.
 * Exits 0 on success, 1 on any missing/invalid variable.
 *
 * Standalone JS (no TS transpile) so it runs in any Node ≥18 without a
 * build step. Keeps the logic in sync with src/lib/env.ts.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Best-effort .env loader (no dotenv dep). Only sets keys not already in env.
function loadDotenv(path) {
  if (!existsSync(path)) return;
  const txt = readFileSync(path, "utf8");
  for (const rawLine of txt.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotenv(resolve(repoRoot, ".env"));

// Keep in sync with src/lib/env.ts SPEC.
const REQUIRED = [
  "APP_URL",
  "NODE_ENV",
  "DATABASE_URL",
  "REDIS_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "JWT_SECRET",
];
const REQUIRED_IN_PROD = [
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
];
const URLS = ["APP_URL", "NEXTAUTH_URL", "DATABASE_URL", "REDIS_URL", "BULLMQ_REDIS_URL"];
const BOOLEANS = ["MIDTRANS_IS_PRODUCTION"];

const isProd = process.env.NODE_ENV === "production";
const required = isProd ? [...REQUIRED, ...REQUIRED_IN_PROD] : REQUIRED;
const errors = [];

for (const key of required) {
  const v = process.env[key];
  if (!v || v.trim() === "") errors.push(`Missing required env: ${key}`);
}

for (const key of URLS) {
  const v = process.env[key];
  if (v && v.trim() !== "") {
    try {
      // eslint-disable-next-line no-new
      new URL(v);
    } catch {
      errors.push(`Invalid URL in env ${key}: "${v}"`);
    }
  }
}

for (const key of BOOLEANS) {
  const v = process.env[key];
  if (v !== undefined && v !== "" && v !== "true" && v !== "false") {
    errors.push(`Env ${key} must be "true" or "false" (got: "${v}")`);
  }
}

if (errors.length > 0) {
  console.error("\n✗ Environment validation failed:");
  for (const e of errors) console.error("  - " + e);
  console.error("\nSee .env.example and docs/env-vars.md for the full list.\n");
  process.exit(1);
}

console.log(`✓ Environment validated (${required.length} required vars, mode=${process.env.NODE_ENV || "development"})`);
