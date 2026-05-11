# Environment Variables — MASJIDOASIS

Authoritative reference for all environment variables consumed by the app.
Mirrors `.env.example` and the runtime validator in `src/lib/env.ts`.

## Quick start

```bash
cp .env.example .env       # never committed (.gitignore: .env*)
# edit .env with real values
node scripts/check-env.mjs # verify before booting
```

Boot scripts (`predev`, `prestart`) call `check-env.mjs` automatically so a
missing variable fails fast with a readable error instead of an opaque
runtime crash deep inside Next.js / Prisma.

## Required at boot (all environments)

| Var | Purpose |
|-----|---------|
| `APP_URL` | Public base URL of the app (used in callbacks, emails). |
| `NODE_ENV` | `development` / `test` / `production`. |
| `DATABASE_URL` | Postgres 16 connection string (Prisma). |
| `REDIS_URL` | Redis 7 connection for cache / sessions. |
| `NEXTAUTH_SECRET` | NextAuth v5 signing secret. Generate: `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | NextAuth canonical URL (usually equals `APP_URL`). |
| `JWT_SECRET` | API token signing secret (separate from NextAuth). |

## Required additionally in production (`NODE_ENV=production`)

| Var | Purpose |
|-----|---------|
| `BULLMQ_REDIS_URL` | Queue broker (can equal `REDIS_URL` for small deploys). |
| `OTP_PROVIDER`, `OTP_API_KEY` | Phone-number OTP provider (default: fonnte). |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` | Payment gateway. |
| `KIRIMINAJA_API_KEY` | Shipping provider. |
| `WHATSAPP_PROVIDER`, `WHATSAPP_API_KEY` | WhatsApp blast. |
| `EMAIL_PROVIDER`, `EMAIL_API_KEY` | Email blast. |
| `STORAGE_DISK`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` | S3-compatible object storage. |

## Optional

| Var | Default | Purpose |
|-----|---------|---------|
| `MIDTRANS_IS_PRODUCTION` | `false` | Toggle Midtrans sandbox/prod. |
| `STORAGE_ENDPOINT` | — | Custom S3 endpoint (MinIO, Wasabi…). |
| `STORAGE_REGION` | `ap-southeast-1` | S3 region. |
| `PRISMA_LOG_LEVEL` | `warn` | `query` / `info` / `warn` / `error`. |
| `SENTRY_DSN` | — | Error reporting. |

## Validation rules

Implemented in `src/lib/env.ts` and the standalone `scripts/check-env.mjs`
(both kept in sync — change them together).

- Required variables must be present and non-empty.
- URL-typed variables (`APP_URL`, `NEXTAUTH_URL`, `DATABASE_URL`, `REDIS_URL`,
  `BULLMQ_REDIS_URL`) must parse via `new URL(v)`.
- Boolean variables (`MIDTRANS_IS_PRODUCTION`) must be the literal string
  `"true"` or `"false"`.
- Validation runs in `development` with a reduced set; the full
  production set is enforced when `NODE_ENV=production`.

On failure the validator throws `EnvValidationError` listing every offending
key — never just the first one.

## Secret management

- **Never commit real secrets.** `.env*` is git-ignored.
- Local development: use a personal `.env` file.
- CI: GitHub Actions secrets injected as workflow `env:` (see
  `.github/workflows/`).
- Production: managed by the deploy host's secret store (Vercel env vars,
  Doppler, SOPS-encrypted file, AWS Secrets Manager, etc.).
- Rotation: rotate `NEXTAUTH_SECRET` / `JWT_SECRET` invalidates active
  sessions — schedule alongside maintenance windows.

## Consuming env in code

```ts
import { getEnv } from "@/lib/env";

const env = getEnv(); // validated, cached, frozen
const url = env.DATABASE_URL;
```

Direct `process.env.FOO` access still works but bypasses validation —
prefer `getEnv()` in application code.
