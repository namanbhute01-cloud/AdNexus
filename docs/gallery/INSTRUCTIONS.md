# INSTRUCTIONS — ADNEXUS Community Gallery (for opencode)

You are implementing the **Community Gallery** upgrade in the existing monorepo `ADNEXUS_PRO` (AdNexus CMS / Vaart-E).
The design spec is **`docs/gallery/ARCHITECTURE.md`**. Read it fully before touching code. This file tells you *how to work*; the architecture file tells you *what to build*.

## 0. Mission

Students scan a QR code and upload photos with **no account**. The admin approves or rejects each photo. Approved photos play on the existing CMS displays via the existing campaign → screen-assignment → player pipeline.

**Core rule: submission ≠ publication.** Anonymous requests may only create `PENDING` rows with private files. Only an authenticated admin action creates `Media` / `CampaignMedia`.

## 1. Stack facts (from the repo README — confirm in T0)

- pnpm workspaces + Turborepo. `apps/web` = Next.js 16 (App Router, Turbopack, React 19, Tailwind 4). `apps/display` = static HTML player. `packages/database` = Prisma 5 → PostgreSQL (`@vaart/database`). `packages/storage` = Cloudflare R2 helpers, with local-disk fallback under `apps/web/public/uploads/`.
- Auth: Auth.js / NextAuth v5, JWT sessions, Credentials provider. Route protection in `apps/web/proxy.ts` is coarse; role checks live in API routes.
- Realtime: Pusher is optional; TVs poll when it is absent.
- Next 16 specifics: `params` and `cookies()` / `headers()` are **async** — `await` them. Route handlers that use `sharp`, `crypto` or the filesystem must declare `export const runtime = 'nodejs'`.
- Node ≥ 20.9, pnpm 9+.

## 2. Hard rules (never violate)

1. **Never run `prisma migrate dev`** — the repo has a missing migration and it will try to reset the database. Hand-write the migration SQL and apply with `prisma migrate deploy`.
2. **Additive only.** Do not alter, rename or drop existing tables, columns, enums, users or relations. Do not delete the `CAMPAIGNER` role value or any seeded data from the database.
3. **No `BigInt`** in any new Prisma model, API response or JSON path (`Media.sizeBytes` drift — see README "Known repo issues"). Use `Int`.
4. **Pending photos are never written under `public/`** or any publicly served R2 prefix. Resolve + assert path prefixes to prevent traversal. Never use user-supplied filenames.
5. **Every `/api/admin/gallery/**` handler calls `requireAdmin()` first** (401 no session, 403 non-admin). Do not rely on `proxy.ts` or hidden UI.
6. **Do not modify player/display code** (`/player`, `/display`, `apps/display`) unless T0 proves it is required; log any such change in `docs/gallery/DECISIONS.md` first.
7. **No new dependencies** except `sharp`, `qrcode` (+ `@types/qrcode`), and `zod` (only if not already present). Anything else → `DECISIONS.md` with justification.
8. **No secrets in git.** New secrets go in `.env.local` / `.env.example` placeholders only.
9. **No raw IPs stored** — HMAC-hash with `GALLERY_IP_SALT`.
10. **Never expose internal errors** to public endpoints: return `{ "error": "<CODE>" }`.
11. Do not "fix" unrelated issues you find. List them in `docs/gallery/AUDIT.md` under "Out-of-scope findings".

## 3. Working protocol

- Branch: `feat/community-gallery`. One commit per task, message `gallery(Tn): <summary>`.
- After **every** task run, and fix before continuing:
  ```bash
  pnpm --filter web exec tsc --noEmit
  pnpm --filter web lint
  ```
  After tasks touching tests/DB also run the task's own verification (listed below).
- Append a short entry to `docs/gallery/PROGRESS.md` after each task: what changed, files touched, how verified, anything deferred.
- When something is ambiguous, **choose the safest option that satisfies the acceptance criteria**, record it in `docs/gallery/DECISIONS.md` (decision, alternatives, reason), and continue. Only stop for missing credentials/services you cannot mock.
- Prefer small, typed, well-named modules. Put gallery code under `apps/web/lib/gallery/**`, `apps/web/app/contribute/**`, `apps/web/app/admin/gallery/**`, `apps/web/app/api/contribute/**`, `apps/web/app/api/admin/gallery/**`. Match existing code style and component patterns.

## 4. Priorities

- **P0 (must ship before the event):** T0 → T10, T12.
- **P1 (if time permits):** review-mode hotkeys/bulk polish (in T9) and T11.
- Do T10 (auth lock-down) **before** any instruction to expose the app publicly.

---

## 5. Tasks

### T0 — Audit (no functional code changes)

Produce `docs/gallery/AUDIT.md` answering, with file paths and line references:

1. Prisma: exact fields/types/enums of `User`, `Media`, `Campaign`, `CampaignMedia`, TV and screen-assignment models; whether `(campaignId, order)` is unique; media `type`/`status` values; required fields on `Media` for an image.
2. Migrations: list in `packages/database/prisma/migrations/`; confirm `migrate deploy` works on a fresh DB.
3. Auth: `authorize()` logic, how `role` reaches the session/JWT, `proxy.ts` matcher and redirects.
4. **Route table of every `apps/web/app/api/**` route:** method, auth required (none/session/admin/device), notes. Flag any unauthenticated route that mutates data or leaks data.
5. Storage: `packages/storage` public API; the exact code path that creates an image `Media` on upload (R2 vs local); how the public URL / `r2Key` is derived; the `allowLocalUploads` setting mechanism.
6. Player: playlist endpoint, auth/identification of devices, poll interval, Pusher channel/event names, **the helper that publishes "playlist/campaign changed"**, how `IMAGE` media + duration are rendered and preloaded.
7. Existing dependencies relevant to this work (`zod`, `sharp`, `qrcode`, Pusher libs).
8. Out-of-scope findings (bugs, insecure defaults) — list only.

Then reconcile any provisional names in `ARCHITECTURE.md` with reality in `DECISIONS.md`.
**Done when:** AUDIT.md committed; no non-doc files changed.

### T1 — Schema + migration

- Add `GalleryPhotoStatus`, `GalleryEvent`, `GalleryPhoto` to `packages/database/prisma/schema.prisma` exactly as in ARCHITECTURE §5 (adjust only what T0 proves necessary).
- Hand-write `migrations/<timestamp>_gallery/migration.sql`.
- Verify with `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`: the only remaining diff must be the known `Media.sizeBytes` drift.
- `prisma migrate deploy` then `prisma generate`.
- Add a seed helper (not the default seed) `packages/database/scripts/create-gallery-event.ts`: creates a `GalleryEvent` from CLI args (`--slug --name --campaignId`).
**Done when:** deploy succeeds on a fresh DB and on a copy of an existing DB; existing smoke test (`npx tsx smoke-test.ts`) still passes.

### T2 — Private storage

- Implement `PrivateStore` (ARCHITECTURE §6) in `packages/storage`: local driver (`GALLERY_PRIVATE_DIR`, default `apps/web/.data/gallery`, add to `.gitignore`) and R2 driver (`gallery/pending/` prefix, no public URL).
- Choose driver by the same config checks the base app uses (R2 configured vs `dummy`/missing).
- Unit tests: put/get/delete round-trip; path traversal attempts (`../`, absolute paths, encoded) are rejected.
**Done when:** tests pass; confirm nothing is written under `apps/web/public/`.

### T3 — Image pipeline (`apps/web/lib/gallery/image-pipeline.ts`)

Implement `processUpload(buffer, opts)` per ARCHITECTURE §7.2 steps 7–10: magic-byte sniff (JPEG/PNG/WebP), `sharp` with `limitInputPixels: 50_000_000`, `failOn: 'error'`, `.rotate()`, resize fit-inside 2560, JPEG q85 mozjpeg, thumbnail 480 q70, sha256 of output, 15 s timeout, a global semaphore (max 3), `sharp.concurrency(2)`.
Returns `{ full: Buffer, thumb: Buffer, width, height, sizeBytes, sha256 }` or a typed error (`BAD_TYPE`, `BAD_IMAGE`, `TOO_LARGE_PIXELS`, `TIMEOUT`, `BUSY`).
Tests with generated fixtures: valid JPEG/PNG/WebP; text file renamed `.jpg`; SVG renamed `.png`; truncated JPEG; polyglot (valid image + appended script); oversized-dimension PNG; JPEG with EXIF GPS + orientation (assert GPS gone, orientation applied).
**Done when:** all fixtures behave as expected.

### T4 — Guards and utilities (`apps/web/lib/gallery/`)

- `require-admin.ts` → `requireAdmin()` returns session or throws a 401/403 `Response`.
- `upload-token.ts` → `signToken(slug)` / `verifyToken(token, slug)`; HMAC-SHA256 with `GALLERY_TOKEN_SECRET`, payload `{slug, iat, jti}`, 6 h TTL, constant-time compare.
- `rate-limit.ts` → in-memory sliding window keyed by string; periodic cleanup; configurable limit/window.
- `client-ip.ts` → `getClientIp(req)` honoring `TRUST_CF_HEADER`; `hashIp()` HMAC with `GALLERY_IP_SALT` (truncate to 16 hex chars).
- `sanitize.ts` → trim, strip control/zero-width chars, length caps (name 60, caption 140).
- Env validation module that fails fast at boot if `GALLERY_TOKEN_SECRET`/`GALLERY_IP_SALT` are missing or < 32 chars (only when gallery routes are hit, not at import in unrelated routes).
**Done when:** unit tests cover token tamper/expiry/wrong-slug, rate-limit windows, sanitize edge cases.

### T5 — Public API

- `GET /api/contribute/[slug]/session` → `{ open, name, limits:{maxFiles,maxFileBytes}, token }`; 404 if unknown, `open:false` if closed. `Cache-Control: no-store`.
- `POST /api/contribute/[slug]/photos` → exactly the 12-step flow in ARCHITECTURE §7.2, using T3/T4 modules and T2 store. Rate limits: ip-hash 20/10 min, token = event `perTokenCap`, global 120/min. Return codes as specified (`EVENT_CLOSED` 403, `BAD_TOKEN` 401, 429, `INTAKE_FULL` 503, `TOO_LARGE` 413, `BAD_TYPE` 415, `BAD_IMAGE` 422, `BUSY` 503).
- Clean up stored objects if the DB insert fails.
- Ensure `proxy.ts` does not intercept these routes.
**Done when:** integration tests (or a scripted `curl`/`fetch` suite) cover: success; closed event; bad/expired token; missing consent; honeypot filled; oversized; wrong type; duplicate image (returns 200 `duplicate:true`, one row); rate-limit 429; pending cap.

### T6 — Public contribution page (`/contribute/[slug]`)

Mobile-first, single column, large touch targets, works in in-app browsers (**no cookies / localStorage dependence**).
Behavior per ARCHITECTURE §7.1: session fetch, multi-select, client-side downscale to 2560 px JPEG q0.85 (`createImageBitmap` with `imageOrientation:'from-image'`, canvas fallback), thumbnails with remove, optional name/caption, required consent checkbox with clear wording ("My photos may be displayed on campus screens after review"), hidden honeypot, sequential/2-concurrent upload with per-file progress, retry with backoff, friendly states: closed, intake full, rate-limited, network error, success.
Add `export const metadata = { robots: { index: false } }` and the security headers from ARCHITECTURE §11 (via `next.config.ts` `headers()` for `/contribute/:path*`).
**Done when:** works end-to-end on desktop Chrome plus mobile emulation (and a real phone if possible); Lighthouse mobile performance not alarming; no console errors.

### T7 — Admin API (`/api/admin/gallery/**`)

Implement the routes in ARCHITECTURE §4 with `zod` validation: events list/create/patch, stats, photos list (status filter, cursor pagination, newest first, limit ≤ 100), image streaming (`?v=thumb|full`, `Cache-Control: private, no-store`, correct `Content-Type`, `X-Content-Type-Options: nosniff`), reject, remove, bulk (≤ 50 ids). Approve is implemented in T8.
When an event's `campaignId` is set/changed, verify the campaign exists.
**Done when:** authz sweep test passes (every route → 401 unauthenticated, 403 as non-admin, works as admin).

### T8 — Approve / publish service (`apps/web/lib/gallery/publish.ts`)

Implement approve, remove and the notifier call **exactly** per ARCHITECTURE §8.2 and §9:
- compare-and-swap claim via `updateMany … where status in (...)`;
- promote file into the existing media storage using the **existing** helper found in T0;
- Prisma `$transaction` with `pg_advisory_xact_lock(hashtext(campaignId))` (`$executeRaw`) around order assignment + `Media` + `CampaignMedia` creation + photo update;
- rollback of status and promoted file on failure;
- after commit: delete private full-size, call the **existing** playlist-changed publisher for the campaign (reuse; do not write a new Pusher integration);
- idempotent: repeated approve returns `alreadyApproved`.
Expose `POST /api/admin/gallery/photos/[id]/approve` and wire bulk approve to it.
**Done when:** concurrency tests pass: 10 parallel approvals of one photo → exactly 1 `Media` + 1 `CampaignMedia`; 5 parallel approvals of different photos → distinct sequential `order`; remove then re-approve works; reject never creates Media.

### T9 — Admin UI

Reuse the existing admin layout, nav and component patterns. Add "Gallery" to admin nav with a live pending badge.
- `/admin/gallery`: events list + create form.
- `/admin/gallery/[eventId]`: counts, **Pause/Resume submissions** toggle (prominent), QR panel (URL, copy, PNG 1024 px + SVG download via `qrcode`, ECC `H`, URL printed under the code), tabs (Pending/Approved/Rejected/Removed), thumbnail grid, multi-select, bulk Approve/Reject, click-through full preview.
- `/admin/gallery/[eventId]/review` (P1 polish): full-screen queue, hotkeys **A** approve, **R** reject, **Z** undo, **←/→** navigate, auto-advance, preload next 3 images.
- Poll `/stats` every 5 s; update document title `(n) Gallery`.
- Optimistic updates with rollback + toasts.
**Done when:** a pending photo can be approved/rejected from the grid in ≤ 2 clicks; pausing intake takes effect immediately on the public page.

### T10 — Auth lock-down and hardening (**required before public exposure**)

- Credentials `authorize()`: reject users whose role ≠ `ADMIN`.
- `/dashboard` → redirect admins to `/admin`; others to `/login`. Remove campaigner links from nav. Hide/disable campaigner creation in any user-management UI. Do **not** delete enum values or DB rows.
- Production admin bootstrap from `ADMIN_EMAIL` / `ADMIN_PASSWORD`; seed must not create `Admin@123` / `Client@123` unless `NODE_ENV !== 'production'`. Document the rotation steps.
- Login rate limit: 5 attempts / 15 min per (IP + email).
- Fix any unauthenticated mutating/data-leaking routes flagged in T0 §4 **if** they are not required by the display player; if they are required by the player, document the exposure in `DECISIONS.md` and add the least-invasive protection (e.g. device identifier check) without breaking players.
- Security headers per ARCHITECTURE §11.
- `/api/health` returning `{ ok: true }` only.
**Done when:** unauthenticated sweep of the whole `/api/**` surface matches the intended table; no default credentials work in production mode.

### T11 — Test suite and E2E script (P1)

- Consolidate unit/integration tests; add `pnpm --filter web test:gallery`.
- Add `scripts/gallery-smoke.ts`: creates an event, uploads N sample images against a running server, approves some via admin session, rejects some, asserts playlist contents via the player's playlist endpoint, asserts rejected images are absent.
- Load check (autocannon/k6 or a script): 200 uploads over 2 minutes; server stays responsive; memory stable.

### T12 — Docs and runbook

Create `docs/gallery/RUNBOOK.md`: env setup, migration steps (`migrate deploy`), build/start (`pnpm --filter web build && pnpm --filter web start`, **not** `dev`), Cloudflare **named** tunnel setup, QR generation/printing guidance, PM2 config, DB backup command, event-day checklist, "something is wrong" playbook (spam wave → Pause intake; inappropriate photo → Remove; server down → restart + fallback URL), post-event teardown (close event, export/delete private files).
Update root `README.md` with a short "Community Gallery" section linking the docs, and add new vars to `.env.example`.

---

## 6. Global Definition of Done

- [ ] `tsc --noEmit` and `lint` clean
- [ ] Migration applies via `migrate deploy` only; no existing table changed
- [ ] Anonymous user can upload; cannot read anything private or call any admin route
- [ ] Pending files exist only in the private store; approved files only after approval
- [ ] Approve is idempotent and race-safe (tests prove it)
- [ ] Approved photo appears on a real/simulated player within the player's refresh window; rejected/removed never do
- [ ] Pause-intake works instantly
- [ ] Campaigner login blocked; no default credentials in production mode
- [ ] Existing campaigns, assignments and players unaffected (run existing smoke test)
- [ ] `AUDIT.md`, `DECISIONS.md`, `PROGRESS.md`, `RUNBOOK.md` present and accurate

## 7. Final report format

When finished (or blocked), reply with: (1) task checklist with status, (2) files added/changed summary, (3) deviations from ARCHITECTURE.md and why, (4) known gaps/risks, (5) exact commands to run the app and to run the tests, (6) anything the human must do (env vars, tunnel, rotate admin password).
