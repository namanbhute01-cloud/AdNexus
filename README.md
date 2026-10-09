# AdNexus CMS (Vaart-E)

A monorepo for managing digital signage across EVs (electric vehicles). Admins
upload media and build campaigns, assign them to screens, and each TV pulls its
playlist over HTTP with optional realtime push via Pusher.

## Stack

| Layer     | Tech                                          |
| --------- | --------------------------------------------- |
| Framework | Next.js 16 (App Router, Turbopack), React 19   |
| Auth      | Auth.js / NextAuth v5, JWT sessions, Credentials provider |
| ORM       | Prisma 5 -> PostgreSQL                        |
| Styling   | Tailwind CSS 4                                |
| Storage   | Cloudflare R2 (S3-compatible), or local disk   |
| Realtime  | Pusher (optional)                             |
| Monorepo  | pnpm workspaces + Turborepo                   |

## Requirements

- **Node.js >= 20.9.0** (Next.js 16 hard requirement)
- **pnpm** 9+
- **PostgreSQL** 14+ running locally

## Quick start

### Windows

Double-click **`setup-windows.bat`** (or run it in PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
```

It installs/checks Node, pnpm and PostgreSQL, installs dependencies, writes the
env files with a freshly generated `AUTH_SECRET`, creates the database, applies
migrations and seeds. Re-run it any time — every step is idempotent.

### macOS / Linux

One command does everything:

```bash
chmod +x setup.sh
./setup.sh            # install prerequisites, dependencies, env, database, seed
./start.sh            # run the app
```

`setup.sh` installs Node.js 20+, pnpm and PostgreSQL if they are missing
(using Homebrew on macOS, apt on Debian/Ubuntu), starts the Postgres service,
runs `pnpm install`, writes both `.env` files with a freshly generated
`AUTH_SECRET`, creates the database, applies migrations and seeds.

To set up and immediately launch the app:

```bash
./setup.sh --start
```

Every step is idempotent, so re-running after a pull is safe — existing `.env`
files and databases are never overwritten.

<details>
<summary>Manual / partial steps</summary>

```bash
pnpm install          # dependencies only
./setup-db.sh         # database only (migrate + seed)
```

`setup-db.sh` needs `sudo` only when it has to create the role or database; once
the database already answers with your credentials it skips straight to
migrating and seeding. Provisioning by hand:

```bash
sudo -u postgres psql -c "ALTER ROLE postgres WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "CREATE DATABASE vaarte OWNER postgres;"
```

</details>

> The script reuses an existing `naarte` or `vaarte` database if one is
> present, so it will not orphan data by inventing a second database name.

## Default logins

Seeded by `packages/database/prisma/seed.ts` — **development only**, change them
before deploying anywhere real.

| Role        | Email                | Password      |
| ----------- | -------------------- | ------------- |
| Admin       | `admin@vaart.com`    | `Admin@123`   |
| Campaigner  | `client@example.com` | `Client@123`  |

The seed also creates EV `NRT-EV-001` ("MG Road, Bangalore") with three TVs
(`NRT-EV-001-TV1` … `TV3`) and grants the campaigner access to it.

## Routes

| Path        | Who       | What                                        |
| ----------- | --------- | ------------------------------------------- |
| `/login`    | public    | Credentials login                           |
| `/dashboard`| campaigner| Their campaigns, media, screens             |
| `/admin/*`  | admin     | EVs, campaigns, media studio, assignments, monitor, users, settings |
| `/player`   | TV screens| Full-screen playlist player                 |
| `/display`  | TV screens| Alternate display shell                     |
| `/api/*`    | —         | Auth, campaigns, media, display heartbeat    |

Route protection lives in `apps/web/proxy.ts`: `/dashboard` and `/admin`
redirect to `/login` when unauthenticated. Note this is a coarse check — the
per-action role checks (admin vs campaigner) are enforced in the API routes, not
in the proxy.

`apps/display/index.html` is a standalone, dependency-free display page for TVs
that cannot run the Next.js player.

## Environment variables

`apps/web/.env.local` (app) and `packages/database/.env` (Prisma CLI).
`DATABASE_URL` must match in both.

| Variable                       | Required | Purpose                                        |
| ------------------------------ | -------- | ---------------------------------------------- |
| `DATABASE_URL`                 | yes      | Postgres connection string                     |
| `AUTH_SECRET`                  | yes      | Signs JWT session cookies                      |
| `NEXTAUTH_URL` / `AUTH_URL`    | yes      | Canonical origin, used for callbacks           |
| `NEXT_PUBLIC_PLAYER_BASE_URL`  | no       | Base URL handed to TVs; defaults to `NEXTAUTH_URL` |
| `R2_ACCOUNT_ID`                | no       | Cloudflare account id                          |
| `R2_ACCESS_KEY_ID`             | no       | R2 access key                                  |
| `R2_SECRET_ACCESS_KEY`        | no       | R2 secret key                                  |
| `R2_BUCKET_NAME`               | no       | R2 bucket                                      |
| `R2_PUBLIC_URL`                | no       | Public base URL for served media               |
| `PUSHER_APP_ID/KEY/SECRET`     | no       | Pusher server credentials                      |
| `PUSHER_CLUSTER`               | no       | e.g. `mt1`                                     |
| `NEXT_PUBLIC_PUSHER_KEY`       | no       | Pusher key exposed to the browser              |
| `NEXT_PUBLIC_PUSHER_CLUSTER`   | no       | Pusher cluster exposed to the browser          |

### R2 and Pusher are optional

Both integrations check their config and **degrade gracefully** when it is
missing or set to the literal string `"dummy"`:

- Without R2, uploads fall back to local disk under `apps/web/public/uploads/`
  (gated by the `allowLocalUploads` app setting, on by default).
- Without Pusher, TVs simply poll instead of receiving realtime pushes.

So the default `dummy` values give you a fully working local dev setup.

## Ports

The dev server binds `0.0.0.0:3000` so physical TV screens on the LAN can reach
it. Set `NEXT_PUBLIC_PLAYER_BASE_URL` to your machine's LAN IP (e.g.
`http://192.168.29.82:3000`) when handing player URLs to real devices —
`next.config.ts` also allow-lists that origin via `allowedDevOrigins`.

## Project structure

```
apps/
  web/            Next.js 16 app (admin + dashboard + player + API)
  display/        standalone HTML display page for TVs
packages/
  database/       Prisma schema, migrations, seed, smoke test
  storage/        Cloudflare R2 helpers
setup.sh          One-shot setup for Linux/macOS (all prerequisites)
setup-windows.ps1 Windows setup (all prerequisites)
setup-windows.bat double-clickable wrapper for the above
setup-db.sh       Database-only bootstrap (Linux/macOS)
start.sh          Starts the web app
```

## Useful commands

```bash
pnpm dev                                  # run all dev tasks
pnpm --filter web dev                     # run just the web app
pnpm --filter web lint                    # eslint
pnpm --filter web exec tsc --noEmit       # typecheck
pnpm --filter @vaart/database exec prisma studio   # browse data
cd packages/database && npx tsx smoke-test.ts     # data-layer self-test
```

## Troubleshooting

**`error: P1001: Can't reach database server`** — Postgres is not running.
Linux/macOS: `sudo systemctl start postgresql`. Windows: `Start-Service postgresql-x64`.

**`Environment variable not found: DATABASE_URL`** — the `.env` file is missing
where the command ran from. The Prisma CLI reads `packages/database/.env`, the
app reads `apps/web/.env.local`.

**Turbopack picks the wrong workspace root** — fixed in `next.config.ts` by
pinning `turbopack.root` to the monorepo root. If you move the repo, that path
still resolves because it is derived from `__dirname`.

**First compile is very slow (1–3 min)** — this is Turbopack on a slow or busy
disk, not a hang. Wait for it, or free up CPU by stopping other heavy services.

### Known repo issues

These are pre-existing and worth knowing about before you touch the database:

1. **A migration is missing from git.** Databases created from an earlier state
   have `20260526000000_media_size_bigint` applied, but that file is not in
   `packages/database/prisma/migrations/`. `prisma migrate deploy` is unaffected,
   but **`prisma migrate dev` will want to reset the database** and wipe data.
   Prefer `migrate deploy` until this is reconciled.

2. **`Media.sizeBytes` drift.** The column is `bigint` in existing databases but
   `Int` in `schema.prisma`. The schema is deliberately left as `Int`: changing
   it to `BigInt` makes Prisma return native `BigInt` objects, which throw
   `TypeError: Do not know how to serialize a BigInt` when
   `app/api/media/route.ts` serialises a media record to JSON. Uploads are capped
   at 500 MB, well within `Int` range.