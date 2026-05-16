# ADR-001 — Stack Selection (Final)

- **Status:** Accepted
- **Date:** 2026-05-11
- **Owner:** Engineering (CERDAS autonomous pipeline)
- **Linear:** MAS-15
- **Supersedes:** —

## 1. Konteks

Platform Komunitas Masjid mencakup **marketplace, wallet/escrow, media dakwah, Q&A ustadz/dokter, crowdfunding infaq, WhatsApp/Email blast, REST API eksternal**, integrasi **Midtrans + KiriminAja + OTP HP**. Estimasi 30–45 hari kerja, scope SOW Rp 25–35 jt. Tim kecil (1–2 dev + AI agent autonomous pipeline). Demo sudah live: `https://demo.viber.id` (Next.js prototype frontend-only).

Wajib: audit log, ledger immutable, role-based access (admin / seller / ustadz / member), webhook idempotent, separation sandbox/production.

## 2. Keputusan

| Layer | Pilihan | Versi target |
|---|---|---|
| Frontend + Backend | **Next.js 16 App Router** (React Server Components + Server Actions + Route Handlers) | `next@^16` |
| Bahasa | **TypeScript strict** | `5.x` |
| Styling | **Tailwind CSS v4** + design tokens (CSS variables di `globals.css`) | `tailwindcss@^4` |
| Icon | **lucide-react** | terbaru |
| ORM | **Prisma** | `prisma@^6` |
| Database | **MySQL 8+** (Supabase / VPS managed) | `pg 16` |
| Cache + Queue broker | **Redis 7** | `redis@^7` |
| Background jobs | **BullMQ** (di-host process Node terpisah, satu repo) | `bullmq@^5` |
| Auth | **NextAuth v5 (Auth.js)** — Credentials provider custom + OTP HP (Fonnte/Wablas adapter), session JWT pendek + refresh, RBAC via `role` claim | `next-auth@5-beta` |
| Payment | **Midtrans Snap + Core API** via adapter `PaymentProvider` (sandbox + production env-switched) | midtrans-client `^1.4` |
| Shipping | **KiriminAja** via adapter `ShippingProvider` | REST direct (no SDK) |
| Storage | **S3-compatible** (idCloudHost Object Storage / R2 / MinIO) via `@aws-sdk/client-s3` | aws-sdk v3 |
| WhatsApp / Email blast | adapter `WhatsappProvider` + `EmailProvider` (Fonnte / Resend / Mailgun) | REST direct |
| Validasi schema | **Zod** | `^3` |
| Testing | **Vitest** (unit) + **Playwright** (e2e payment/wallet/permission) | latest |
| Linting | ESLint + `@typescript-eslint` + Prettier | latest |
| Logging | **pino** + redaction PII/secret | `^9` |
| Observability | OpenTelemetry → optional (Grafana Cloud free / signoz nanti) | — |
| Deploy | **Self-host di VPS** existing — `pm2` atau `systemd` running `next start`, di belakang **Nginx** + Let's Encrypt | — |
| CI | GitHub Actions (build + lint + vitest + prisma migrate dry-run) | — |
| Monorepo? | **NO** — single Next.js app + folder `worker/` untuk BullMQ consumer | — |

## 3. Arsitektur Ringkas

```
                ┌─────────────────────────────┐
   Browser ───▶ │  Nginx (gstd/viber.id, TLS) │
                └──────────────┬──────────────┘
                               │
                ┌──────────────▼──────────────┐
                │   Next.js 16 (port 3000)    │
                │   - App Router pages        │
                │   - Server Actions          │
                │   - Route Handlers /api/*   │
                │   - NextAuth (OTP)          │
                └──┬────────────┬─────────────┘
                   │            │
       Prisma ─────┘            └──── ioredis / BullMQ enqueue
          │                                  │
          ▼                                  ▼
   ┌────────────┐                    ┌──────────────┐
   │ Postgres16 │                    │   Redis 7    │
   └────────────┘                    └──────┬───────┘
                                            │
                                ┌───────────▼──────────┐
                                │  Worker (Node + BullMQ) │
                                │  - Midtrans webhook reconcile
                                │  - KiriminAja tracking poll
                                │  - WA / Email blast
                                │  - PDF / invoice
                                └──────────────────────┘
```

Provider adapters semua tinggal di `src/server/providers/` dengan interface seragam:

```ts
interface PaymentProvider {
  createCharge(input: ChargeInput): Promise<ChargeResult>
  verifyWebhook(headers: Headers, body: string): Promise<WebhookEvent>
}
```

Webhook Midtrans masuk ke `app/api/webhooks/midtrans/route.ts`, validasi signature, simpan ke `webhook_events` (unique key `order_id+transaction_status+signature_key`), lalu enqueue job idempotent.

## 4. Alasan vs Alternatif

### 4a. Next.js full-stack vs **Next + NestJS terpisah**

- **NestJS pros:** struktur OOP rapi, DI, decorators, ecosystem mature.
- **Cons untuk konteks ini:** dua deploy target, dua repo CI/CD, dua proses Node di VPS, dua bundling, dua auth boundary → cost ops tinggi untuk tim 1–2 orang dan timeline 30–45 hari.
- **Next.js App Router** sudah cukup: Server Actions = service layer, Route Handlers = REST API eksternal SOW. Bisa di-extract ke NestJS nanti kalau scale butuh.

### 4b. MySQL vs Postgres vs MongoDB

- **MySQL dipilih** — via request user, mendukung ledger immutable dengan transactions (CHECK constraints, transaction isolation `SERIALIZABLE` saat mutasi saldo), JSONB untuk metadata provider, mature row-level locking untuk escrow.
- Mongo lemah di transaksi multi-dokumen + audit trail keuangan.
- MySQL OK tapi JSONB & CTE Postgres lebih ergonomis untuk reporting.

### 4c. Redis wajib

- Rate limit OTP (anti-spam HP).
- Idempotency key cache untuk webhook.
- BullMQ broker untuk WA blast (batching, retry, backoff).
- Session blacklist + short-lived OTP code (TTL 5 menit).

### 4d. Prisma vs Drizzle vs TypeORM

- **Prisma** — DX terbaik, migration system jelas (`prisma migrate`), generated types langsung kepake di Server Actions, tooling Studio buat admin lihat data.
- Drizzle lebih cepat tapi ergonomic migration kurang.
- TypeORM = legacy.

### 4e. Auth.js (NextAuth v5) vs custom JWT

- Auth.js v5 sudah mendukung Server Actions + Credentials custom → cukup untuk OTP HP.
- Session JWT 15 menit + refresh token DB, role di claim, di-cek via middleware.
- Kalau kompleks (multi-tenant, SSO) bisa pindah ke Clerk/WorkOS — tapi over-engineering sekarang.

### 4f. BullMQ vs Inngest vs cron-only

- Webhook payment + blast WA jelas async + retryable + observable → BullMQ menang.
- Cron-only ngga cukup untuk burst blast.
- Inngest = SaaS, melanggar batas budget & data residency.

## 5. Struktur Repo Target

```
masjidoasis/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   ├── (auth)/
│   │   ├── (member)/
│   │   ├── (seller)/
│   │   ├── (admin)/
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       ├── webhooks/midtrans/
│   │       ├── webhooks/kiriminaja/
│   │       └── v1/  (REST API eksternal SOW)
│   ├── components/         # client + server components
│   ├── server/
│   │   ├── db.ts           # prisma client singleton
│   │   ├── auth.ts         # NextAuth config
│   │   ├── providers/      # midtrans, kiriminaja, wa, email, storage adapters
│   │   ├── services/       # order, wallet, ledger, escrow, product, qa, infaq
│   │   ├── jobs/           # bullmq queue + worker definitions
│   │   ├── audit.ts        # audit log helper
│   │   └── permissions.ts  # RBAC guards
│   ├── lib/                # client-safe utils, validation (zod schemas)
│   └── types/
├── worker/
│   └── index.ts            # BullMQ consumer process (pm2 ecosystem)
├── docs/
│   ├── adr/                # ADR-00x
│   ├── api/                # REST API eksternal spec (OpenAPI)
│   └── ops/                # deploy + runbook
├── tests/
│   ├── unit/
│   └── e2e/
├── .env.example
├── ecosystem.config.js     # pm2 (app + worker)
└── package.json
```

## 6. Konvensi Wajib

1. **No secret di repo.** `.env.example` pakai placeholder, real `.env` di VPS only.
2. **Migration only** untuk schema change — no `prisma db push` di production.
3. **Ledger immutable** — tabel `ledger_entries` append-only, reversal pakai entry baru, never `UPDATE`/`DELETE`.
4. **Audit log wajib** untuk: release escrow, approve withdraw, deactivate user, role change, delete product. Tabel `audit_logs(actor_id, action, target, before, after, ip, ua, ts)`.
5. **Webhook idempotent** — table `webhook_events(provider, external_id, signature, payload, processed_at)` unique constraint.
6. **Adapter pattern wajib** untuk semua provider eksternal. Test pakai mock adapter.
7. **Zod validation** di setiap Server Action + Route Handler boundary.
8. **RBAC guard** di setiap server function, no client-side trust.
9. **Test wajib** untuk: payment webhook, wallet ledger, shipping booking, permission boundaries.
10. **Sandbox/production toggle** lewat env, bukan code branch.

## 7. Environment Variables (lihat juga `CLAUDE.md`)

Sama persis dengan placeholder di `CLAUDE.md`. Tambahan untuk ADR ini:

```env
NEXTAUTH_SECRET=
NEXTAUTH_URL=
BULLMQ_REDIS_URL=
PRISMA_LOG_LEVEL=warn
SENTRY_DSN=          # optional
```

## 8. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Next.js 16 masih relatif baru, beberapa lib belum kompatibel | Pin versi minor, fallback ke 15 jika blocker ditemukan di sprint 1 |
| OTP HP provider rate limit / billing | Adapter pattern → mudah swap (Fonnte ↔ Wablas ↔ Twilio) |
| Webhook Midtrans double-fire | Unique key + state machine `pending→paid→settled` |
| Worker crash kehilangan job | BullMQ persistent + Redis AOF on |
| Postgres tunggal SPOF | Daily logical backup `pg_dump` ke S3, restore runbook di `docs/ops/` |

## 9. Konsekuensi

- ✅ Satu repo, satu deploy target, ops sederhana, timeline realistis.
- ✅ Type-safe end-to-end (Prisma ↔ Server Actions ↔ Client).
- ✅ REST API eksternal tetap delivered via Route Handlers `/api/v1/*`.
- ⚠️ Tergantung Next.js scaling — jika traffic blast besar, worker BullMQ harus discale terpisah.
- ⚠️ NestJS dropped — kalau ada kebutuhan microservice nanti, harus migration besar.

## 10. Tindak Lanjut (next issues)

- MAS-16: scaffold Prisma schema awal (users, sessions, products, orders, ledger_entries, audit_logs).
- MAS-17: setup NextAuth v5 + OTP provider adapter.
- MAS-18: setup BullMQ + worker process di pm2 ecosystem.
- MAS-19: setup CI GitHub Actions (lint, build, vitest, prisma validate).
- MAS-20: docs API v1 OpenAPI skeleton.
