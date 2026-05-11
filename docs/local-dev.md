# Local Development Setup

> MAS-17 — Docker Compose dev environment.

## TL;DR

```bash
# 1. one-time
cp .env.example .env       # fill DATABASE_URL/REDIS_URL/secrets per env-vars.md
npm install                # installs deps + runs `prisma generate`

# 2. every dev session
npm run db:up              # starts postgres:16 + redis:7 in background
npm run prisma:migrate     # applies schema migrations to local DB
npm run dev                # next dev on http://localhost:3000

# 3. stop
npm run db:down            # stop containers (data persists in volumes)
```

## Services provided

| Service  | Image            | Host port | Container name           |
|----------|------------------|-----------|--------------------------|
| Postgres | `postgres:16-alpine` | `5432`    | `masjidoasis-postgres`   |
| Redis    | `redis:7-alpine`     | `6379`    | `masjidoasis-redis`      |
| App *    | `Dockerfile.dev`     | `3000`    | `masjidoasis-app`        |

\* App container only starts under the `full` profile. Default workflow runs the app on the host (`npm run dev`) so hot reload / file watching is fast and editor tooling integrates cleanly. The container option is a backup for environments where Node 20+ is not installable on the host.

## Connection strings

Use these in your local `.env`:

```env
# host-side `npm run dev`
DATABASE_URL=postgresql://masjidoasis:masjidoasis@localhost:5432/masjidoasis?schema=public
REDIS_URL=redis://localhost:6379
BULLMQ_REDIS_URL=redis://localhost:6379
```

If you switch to the containerized app (`npm run compose:up`), the app container resolves `postgres` and `redis` by service name — those env values are wired in `docker-compose.yml` automatically; you don't need to override them in `.env`.

## Common operations

### Reset the database (DESTRUCTIVE)
```bash
docker compose down -v    # deletes postgres_data + redis_data volumes
npm run db:up
npm run prisma:migrate
```

### Tail logs
```bash
npm run db:logs           # postgres + redis
docker compose logs -f app   # only when running under --profile full
```

### Open a psql shell
```bash
docker exec -it masjidoasis-postgres psql -U masjidoasis -d masjidoasis
```

### Run a one-off Prisma command against the local DB
```bash
npm run prisma:studio     # GUI at http://localhost:5555
npx prisma db pull        # introspect existing schema
```

## Profiles

| Profile  | Services                  | Use case                                         |
|----------|---------------------------|--------------------------------------------------|
| _(default)_ | `postgres`, `redis`    | Host runs `npm run dev`. Recommended for daily dev. |
| `full`   | `+ app`                   | Fully containerized stack. Slower hot reload.    |

Activate the `full` profile:
```bash
docker compose --profile full up -d    # or: npm run compose:up
```

## Troubleshooting

**`port is already allocated` on 5432 or 6379**
Another Postgres/Redis is already running on the host. Either stop it, or edit the `ports:` mapping in `docker-compose.yml` to bind to a different host port (e.g. `"5433:5432"`) and update `DATABASE_URL` accordingly.

**`prisma generate` fails after `npm install`**
The Prisma engine CDN is sometimes flaky. Just re-run `npx prisma generate`. The CI workflow (`.github/workflows/ci.yml`) retries automatically.

**`P1001: Can't reach database server`**
Containers may still be starting. Healthchecks normally guard against this for the `app` service, but for host-side `npm run dev` there's no gate — wait ~5s after `npm run db:up` or run `docker compose ps` until `postgres` is `(healthy)`.

**Data didn't persist across `db:down` / `db:up`**
That's expected only if you ran `docker compose down -v`. Named volumes `masjidoasis_postgres_data` and `masjidoasis_redis_data` persist data across restarts otherwise.

## Production note

This compose file is **dev only**. Production deployment is self-hosted on the VPS via pm2/systemd + Nginx + Let's Encrypt per ADR-001 §2. Postgres in production runs as a managed service (Supabase or VPS-managed instance), not a containerized one-shot.
