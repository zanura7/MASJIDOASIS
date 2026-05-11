# CI/CD Pipeline (MAS-18)

GitHub Actions workflow lives at `.github/workflows/ci.yml`.

## Triggers

- **Push to `main`** → lint, typecheck, test, build, deploy-production (stub).
- **Pull request → `main`** → lint, typecheck, test, build, deploy-preview (stub).

`concurrency` cancels superseded runs on the same ref so only the latest
push/PR commit is built.

## Jobs

| Job | Purpose |
|-----|---------|
| `lint` | `npm run lint` (next lint / ESLint). |
| `typecheck` | `npx tsc --noEmit` if `tsconfig.json` exists. Skipped on bare repo. |
| `test` | `npm test --if-present`. Runs Vitest (`vitest run`) wired in MAS-20 — see `docs/testing.md`. |
| `build` | `npm run build` (= `prisma generate && next build`). Uploads `.next` artifact for 7 days, excluding `.next/cache`. |
| `deploy-preview` | PR-only stub. To be wired up when preview infra (Vercel project / VPS preview env) is provisioned. |
| `deploy-production` | `main`-only stub. `demo.viber.id` is currently served by a separate root-owned process on the VPS; real deploy will replace the stub when infra is owned by the pipeline. |

## Environment

CI sets a dummy `DATABASE_URL` so `prisma generate` / `prisma validate` don't
fail on missing env. No real DB connection is ever made during CI — `next
build` does not connect, and `prisma migrate` is not run in CI.

`NEXT_TELEMETRY_DISABLED=1` to keep logs clean.

## Caching

`actions/setup-node@v4` with `cache: npm` caches `~/.npm` keyed on
`package-lock.json`. First run will be slow; subsequent runs hit the cache.

## Dependabot

`.github/dependabot.yml` opens weekly grouped PRs for npm + GitHub Actions
updates every Monday 06:00 WIB. Groups: `next`, `prisma`, `react`, `types`.
Limit 5 npm + 3 actions PRs open at a time. PRs are auto-labelled
`type:chore` / `area:devops` to match the Linear taxonomy.

## Adding real deploys later

Replace the two stub jobs with provider-specific steps:

- **Vercel:** `amondnet/vercel-action@v25` with `vercel-token`, `vercel-org-id`, `vercel-project-id` secrets.
- **VPS SSH:** `appleboy/ssh-action@v1` with `ssh-key`, `host`, `user` secrets; run `git pull && npm ci && npm run build && systemctl restart masjidoasis` on the box.

Add the secrets via `gh secret set` once the target environment is decided —
do not commit them.
