# T0 — AUDIT of ADNEXUS_PRO

Repo: `namanbhute01-cloud/ADNEXUS_PRO` @ commit `1648b80` (branch `main`).
Date: 2026-10-11. No functional files were changed to produce this document.

All paths are relative to the repo root. Every claim below is backed by a file/line reference.

---

## 0. Headline findings (read these first)

| # | Severity | Finding |
|---|----------|---------|
| F1 | **BLOCKER** | The player **never re-fetches the playlist**. `apps/web/components/device-player.tsx:91` calls `fetchContent()` exactly once on mount. The only interval in that effect (`:92`) posts to `/api/display/heartbeat` and discards the response. `apps/display/index.html:73` has the same one-shot fetch. **Consequence:** without Pusher, an approved photo never reaches the screen. ARCHITECTURE §9's assumption ("TVs pick changes up on their existing poll cycle") is **false**. |
| F2 | **BLOCKER** | **There is no "playlist changed" notifier to reuse.** Pusher is constructed inline at `apps/web/app/api/admin/assignments/route.ts:7` and fires only on assignment create/delete, to a **per-TV** channel. ARCHITECTURE §8.2 step 5 ("call the existing playlist-changed publisher") has no referent; T8 must author it. |
| F3 | HIGH | `/api/display/content` and `/api/display/heartbeat` authenticate on `X-Serial`/`X-SubSerial` only — no secret. Serials are predictable (`NRT-EV-001-TV1`, or `<serial>-SCREEN-1` minted by `app/api/admin/display-units/route.ts:52`). Anyone can read a playlist or forge heartbeats, which **unboundedly grow `TVHeartbeat`**. |
| F4 | HIGH | `Media.url` has a hardcoded fallback `https://media.vaarte.in/${key}` (`app/api/media/route.ts:28`). With no R2 configured and `allowLocalUploads` off, gallery approvals would produce URLs that 404. |
| F5 | MEDIUM | No test runner exists anywhere (`packages/database/package.json`, `packages/storage/package.json` both stub `"test"`; `apps/web` has no `test` script). See DECISIONS D5. |
| F6 | MEDIUM | `Campaign.status` is never consulted by the player — `/api/display/content:18` picks the active `ScreenAssignment` regardless of status. `ACTIVE` vs `DRAFT` is cosmetic for playback. `/api/campaigns/[id]/submit` sets `PENDING_REVIEW` and nothing ever advances it. |
| F7 | LOW | No `.env.example` exists in the repo. |
| F8 | LOW | `/api/media` `GET` returns **all** media rows to any authenticated user of any role (`:68-93`); the campaigner filter only narrows by EV access. With campaigner sign-in blocked in T10 this becomes admin-only. |
| F9 | **BLOCKER** *(found during T8/T9 integration testing)* | **Next.js snapshots `public/` at server START, not at build.** A file written into `public/uploads/` while the server is running returns **404** until the next restart. Verified: a file created one second before the request 404s; the same file serves 200 after a restart. Consequence: the entire local-disk storage model is unreliable at runtime — including the CMS's own `/api/media/local-upload`. Gallery-approved photos are routed through `app/media/[...path]/route.ts` to avoid this (DECISIONS D13). **The pre-existing CMS upload path still has this limitation.** |
| F10 | HIGH | `removePhoto` read the `Media` row *after* its transaction deleted it, so the promoted file was always orphaned on disk. Fixed in T8 and covered by a regression test. |
| F12 | HIGH | The player raised a **full-screen "Tap to start playback with audio" overlay** whenever a video in the playlist failed unmuted autoplay. Because the overlay covered the whole viewport, a playlist of student **photos plus one video** rendered as a blocking gate instead of the photos. Fixed: autoplay now degrades to muted and restores sound on the first real gesture, and the gate is scoped to items that actually need audio (`type !== "IMAGE"`). |

---

## 1. Prisma — exact models, fields, enums

Source: `packages/database/prisma/schema.prisma`

### `User` (:10-23)
`id cuid` · `email @unique` · `passwordHash String` · `name String` · `role Role @default(CAMPAIGNER)` · `createdAt` · `updatedAt`.
Relations: `media[]`, `campaigns[]`, `evAccess[]`, `sessions[]`.

### `Role` enum (:25-28)
`ADMIN` · `CAMPAIGNER`. **Both values must be kept** (hard rule 2).

### `Media` (:64-79)
| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `userId` | `String` | **required**, FK → `User` (RESTRICT) |
| `filename` | `String` | **required** |
| `originalName` | `String` | **required** — this is the `PlaylistItem.originalName` |
| `r2Key` | `String @unique` | **required + unique** → gives us idempotent approval |
| `url` | `String` | **required** — what the player loads |
| `type` | `MediaType` | `IMAGE` |
| `duration` | `Int?` | nullable; **unused for IMAGE** |
| `sizeBytes` | `Int` | see §9 drift note |
| `status` | `MediaStatus @default(PROCESSING)` | must be `READY` |

**Required set for an image `Media`:** `userId, filename, originalName, r2Key, url, type, sizeBytes, status`. `duration` may be omitted.

### `MediaType` (:81-85) `VIDEO` · `IMAGE` · `AUDIO`
### `MediaStatus` (:87-91) `PROCESSING` · `READY` · `FAILED`

### `Campaign` (:93-104)
`id` · `userId` (required FK) · `name` · `status CampaignStatus @default(DRAFT)` · `createdAt` · `updatedAt`.

### `CampaignStatus` (:106-112) `DRAFT` · `PENDING_REVIEW` · `ACTIVE` · `PAUSED` · `ARCHIVED`

### `CampaignMedia` (:114-130)
| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `campaignId` | `String` | **required** FK |
| `mediaId` | `String` | **required** FK |
| `order` | `Int` | playback order |
| **`displayTime`** | `Int @default(10)` | **seconds, for images** — this is the field, *not* `durationSeconds` |
| `playbackLayer` | `PlaybackLayer @default(PRIMARY)` | |
| `volumePercent` | `Int @default(100)` | |
| `duckAmbient` | `Boolean @default(true)` | |
| `loopPlayback` | `Boolean @default(false)` | |

- **`@@unique([campaignId, mediaId])` (:128)** — *not* unique on `(campaignId, order)`. Confirmed: `prisma/migrations/20260504125514_init/migration.sql:154` creates `CampaignMedia_campaignId_mediaId_key`; `:151` creates a plain (non-unique) `CampaignMedia_campaignId_order_idx`.
  → **Two approvals can legitimately land on the same `order`.** The `pg_advisory_xact_lock` in ARCHITECTURE §8.2 step 3 is therefore **load-bearing, not defensive**.
- `PlaybackLayer` enum (:132-135): `PRIMARY` · `AMBIENT`.

### `ScreenAssignment` (:137-149)
`id` · `tvId` · `campaignId` · `scheduleType ScheduleType @default(CONTINUOUS)` · `startTime?` · `endTime?` · **`isActive Boolean @default(true)`** · `createdAt`.
`ScheduleType` (:151-155): `CONTINUOUS` · `SINGLE` · `SCHEDULED`.
**No uniqueness on (tvId, isActive)** — the player takes `findFirst`, so duplicate active rows are possible but pre-existing.

### `EV` (:30-39) `serialNumber @unique` · `locationName` · `isActive`
### `TV` (:41-51) `evId` · **`subSerial @unique`** · `screenIndex Int`
### `TVHeartbeat` (:157-164) `tvId` · `ip String?` · `timestamp @default(now())` — append-only, never pruned.
### `UserSession` (:166-174) — **unused**; auth is JWT, not DB sessions.
### `AppSetting` (:176-180) `key @id` · `value` · `updatedAt`

---

## 2. Migrations

`packages/database/prisma/migrations/`:
- `20260504125514_init` — all core tables + `Role`, `MediaType(VIDEO,IMAGE)` enums
- `20260505142204_init` — `PlaybackLayer` enum, `MediaType += AUDIO`, `CampaignMedia` playback columns
- `20260508000000_app_settings` — `AppSetting` (idempotent `IF NOT EXISTS`)
- `migration_lock.toml`

Confirmed drift: `20260526000000_media_size_bigint` is **absent** (README "Known repo issues" #1). Therefore **`prisma migrate dev` must not be run** — confirmed by inspection. `prisma migrate deploy` applies the three above cleanly and is additive-only.

---

## 3. Auth

- `apps/web/auth.ts:8` — `NextAuth({ session: { strategy: "jwt" }, providers: [Credentials({...})] })`.
- `authorize()` (`auth.ts:12-24`): zod-validates `{email, password.min(6)}` → `prisma.user.findUnique({email})` → `bcrypt.compare` → returns `{id, email, name, role}`. **There is no role check today.** T10 adds `role !== "ADMIN" → null`.
- `role` reaches the session via `jwt` callback (`auth.ts:28-34`, sets `token.role`/`token.id`) → `session` callback (`auth.ts:35-41`). Typed in `apps/web/next-auth.d.ts` as `Session.user: { id, role, name?, email? }`.
- `apps/web/proxy.ts` — NextAuth-wrapped default export; `matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]` (`:26`).
  - **`/api/*` is already excluded** → upload bodies bypass the proxy. Confirmed safe.
  - `/contribute/[slug]` **is** matched, but `authorized()` (`auth-config.ts:6-14`) returns `true` for anything outside `/dashboard` and `/admin`. Safe.
  - Next 16 detail: the proxy runtime is `nodejs` and cannot be configured; `experimental.proxyClientMaxBodySize` (default 10 MB) only matters for matched routes. Not an issue for us.
  - **Gap:** `/login` → `/dashboard` redirect exists (`proxy.ts:18-20`), and `/dashboard/layout.tsx:18-20` already bounces `ADMIN` → `/admin`. So T10's `/dashboard` work is largely done; what remains is removing campaigner *sign-in* and the campaigner nav/`/dashboard` surface.
- `/admin/layout.tsx:16-18` already enforces `role !== "ADMIN" → redirect("/dashboard")`. Note it redirects to `/dashboard`, not `/login` — after T10 blocks campaigners, that redirect target would loop for a campaigner who somehow holds a session. T10 fixes this.

---

## 4. Complete `/api/**` route table

| Route | Methods | Auth today | Notes |
|---|---|---|---|
| `/api/auth/[...nextauth]` | * | none | NextAuth |
| `/api/campaigns` | GET | session | filtered by EV access for campaigners |
| | POST/PATCH/DELETE | `ADMIN` | |
| `/api/campaigns/[id]/media` | POST/PATCH/DELETE | `ADMIN` | |
| `/api/campaigns/[id]/submit` | POST | `ADMIN` | sets `PENDING_REVIEW`; never advances (F6) |
| `/api/admin/assignments` | GET/POST/DELETE | `ADMIN` | Pusher fires here only |
| `/api/admin/display-units` | POST/DELETE | `ADMIN` | mints `<serial>-SCREEN-<n>` subserials (predictable) |
| `/api/admin/settings` | GET/PATCH | `ADMIN` | |
| `/api/media` | GET | session | returns **all** media for `ADMIN` (F8) |
| | POST/DELETE | `ADMIN` | creates `Media` row; derives `url` |
| `/api/media/upload-url` | POST | `ADMIN` | R2 presigned **or** local-dev URL |
| `/api/media/local-upload` | PUT | `ADMIN` | writes to `public/uploads/<uid>/<key>`; has path guards |
| `/api/display/content` | GET | **device headers only** | 🔴 **F3** — leaks the full playlist |
| `/api/display/heartbeat` | POST | **device headers only** | 🔴 **F3** — unauthenticated write, unbounded rows |

**No `/api/health` exists.** T10 adds it.

**No mutating route is reachable without a session today**, except `/api/display/heartbeat`, which is player-required. Per INSTRUCTIONS T10 we document that exposure in DECISIONS.md and leave the players working.

---

## 5. Storage

`packages/storage/src/r2.ts` exports exactly three functions: `getUploadUrl`, `getDownloadUrl`, `deleteObject`. It is **not imported by `apps/web`** — the web app builds its own `S3Client` inline at `app/api/media/upload-url/route.ts:44-51`.

**The two upload paths:**

| Driver | Trigger | Key | Result |
|---|---|---|---|
| Local disk | `!hasR2Config() && settings.allowLocalUploads` (`upload-url/route.ts:43-51`) | `uploads/<userId>/<uuid>-<safeFilename>` | `PUT /api/media/local-upload` streams to `apps/web/public/uploads/...` (`local-upload/route.ts:34-43`), `{flags:"wx"}` |
| R2 | `hasR2Config()` (`upload-url/route.ts:54-66`) | `media/<userId>/<uuid>-<safeFilename>` | presigned PUT straight from the browser |

`hasR2Config()` = `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` all non-empty and `!== "dummy"` (`upload-url/route.ts:12-21`).

**`Media.url` derivation** (`app/api/media/route.ts:24-28`) — must be replicated verbatim for promoted gallery photos:
```
key.startsWith("uploads/")          -> `/${key}`                          // served from public/
R2_PUBLIC_URL set and !== "dummy"   -> `${R2_PUBLIC_URL}/${key}`
otherwise                           -> `https://media.vaarte.in/${key}`   // 🔴 F4 dead fallback
```

`allowLocalUploads` is an `AppSetting` row (`lib/app-settings.ts:7,17`), default `true`, editable at `/admin/settings`.

---

## 6. Player / display

- Playlist endpoint: **`GET /api/display/content`** with headers `X-Serial`, `X-SubSerial` (`display/content/route.ts:6-7`).
- Device identification: `prisma.tV.findUnique({where:{subSerial}})` + `tv.ev.serialNumber !== serial` → 401 (`:11-16`). **No secret.**
- Playlist build: `lib/campaign-playlist.ts:19` `getPlaylistForCampaign()` — a single `$queryRaw` selecting `CASE WHEN m.type='IMAGE' THEN cm.displayTime ELSE m.duration END AS duration`. Returns newest-agnostic `ORDER BY cm.order ASC`. An information_schema probe (`:6-17`) picks between an advanced and a legacy projection.
- **Poll interval: none.** `device-player.tsx:91` fetches once; `:92` `setInterval(60000)` is heartbeat-only. `apps/display/index.html:73` fetches once; `:248` is heartbeat-only. → **F1.**
- Pusher: channel **`tv-${serial}-${subSerial}`** (`device-player.tsx:36`), events **`content-update`** (`:123`) and **`clear-content`** (`:129`). Server-side producer: `app/api/admin/assignments/route.ts:46` and `:78`, guarded by `hasPusherConfig()` (`:14-18`) and reading `PUSHER_APP_ID`/`PUSHER_KEY`/`PUSHER_SECRET`/`PUSHER_CLUSTER`. **Channels are per-TV, not per-campaign** → **F2**.
- `IMAGE` rendering: `device-player.tsx:290-292` falls through to `<ImageFrame>` (`:340-362`) — `next/image` with **`unoptimized`**, `object-cover`, auto-advancing after `(item.duration || 10) * 1000` ms (`:348`). `next.config.ts:13-24` allow-lists `http/https` + `hostname: "*"`, so any R2/`media.vaarte.in` URL renders. **Images and durations already work — no player change needed for rendering.**

---

## 7. Relevant dependencies

| Package | Present? | Note |
|---|---|---|
| `zod` | ✅ `apps/web` `^4.4.2` | already a direct dep |
| `sharp` | ❌ | must add |
| `qrcode` / `@types/qrcode` | ❌ | must add |
| `pusher` / `pusher-js` | ✅ `^5.3.3` / `^8.5.0` | reuse, do not re-integrate |
| `uuid` | ✅ `^14.0.0` | key generation |
| `bcryptjs` | ✅ `^3.0.3` | |
| `tsx` | ⚠️ only in `packages/database` devDeps | needed for TS test files |
| test runner | ❌ | see F5 / DECISIONS D5 |
| `node:test` | ✅ Node ≥20.9 built-in | chosen over a new dep |

---

## 8. Environment / build facts

- `.gitignore` currently lists only `node_modules/`, `**/node_modules/`, `.next/`, `dist/`, `.env`. **No `.env.example`, no `.data/`.** Must add `.data/`.
- `next.config.ts` has **no `headers()`** — must be added for `/contribute/:path*` (still fully supported in 16.2.4).
- `turbo.json` defines `build`/`lint`/`dev`. No `test` task.
- `apps/web` scripts: `dev`, `build`, `start`, `lint`. `next lint` was removed in v16; the repo already calls `eslint` directly — correct.
- Next 16 specifics confirmed from the bundled docs: `params` is a **Promise** (`await` it), `cookies()`/`headers()` are async, `headers()` config function unchanged, `revalidateTag` needs 2 args, Turbopack is the default builder.
- **Proxy body buffering**: `experimental.proxyClientMaxBodySize` defaults to 10 MB, but only applies to matched routes. Our upload is `/api/...` (excluded) → not a concern.

---

## 9. Out-of-scope findings (list only — do not fix)

1. `Media.sizeBytes` is `bigint` in live DBs vs `Int` in schema (README #2). Confirmed intentional. New models must use `Int`.
2. `20260526000000_media_size_bigint` missing from git → never run `migrate dev`.
3. `/api/display/content` + `/api/display/heartbeat` trust non-secret serials (F3).
4. `TVHeartbeat` grows without bound; nothing prunes it.
5. `https://media.vaarte.in` hardcoded fallback (F4).
6. `Campaign.status` is never enforced at playback time (F6).
7. `UserSession` model is dead code.
8. `ScreenAssignment` has no uniqueness on `(tvId, isActive)`.
9. `hasAdvancedPlaybackColumns()` runs an `information_schema` query on **every** playlist fetch.
10. `authConfig.authorized` (`auth-config.ts`) duplicates `proxy.ts` logic; two sources of truth.
11. `admin/users/page.tsx` has no create/delete UI, only a `CAMPAIGNER` list — nothing to remove for T10 beyond nav.
12. `setup.sh` / `setup-db.sh` write `AUTH_SECRET` and re-seed `Admin@123` unconditionally (T10/T12 must gate this).

---

## 10. Reconciliation of ARCHITECTURE.md provisional names

| ARCHITECTURE.md says | Reality | Action |
|---|---|---|
| `CampaignMedia.durationSeconds` | `CampaignMedia.displayTime` | use `displayTime` |
| "the helper that publishes playlist changed" | does not exist | author it (DECISIONS D2) |
| "TVs poll when Pusher is absent" | they do not poll | add a content poll to the player (DECISIONS D1, rule-6 exemption) |
| `(campaignId, order)` possibly unique | unique on `(campaignId, mediaId)` only | advisory lock is mandatory |
| `Media` + `CampaignMedia` field names | listed in §1 above | exact fields recorded |
| `/api/health` | does not exist | create in T10 |