# ADNEXUS Community Gallery — Technical Architecture

| | |
|---|---|
| **Target repo** | `namanbhute01-cloud/ADNEXUS_PRO` (AdNexus CMS / Vaart-E monorepo) |
| **First event** | Navaratri 2026 (college) |
| **Doc status** | v1.0 — design spec. Names of existing models/fields are *provisional* until Task T0 (audit) confirms them. |
| **Companion** | `INSTRUCTIONS.md` (execution playbook for opencode) |

---

## 1. Goal and scope

Students scan a QR code, upload photos from their phones **without an account**. The admin reviews every photo and approves or rejects it. Approved photos play on the existing CMS displays through the existing campaign → screen-assignment → player pipeline.

**In scope**
- Public QR landing page + anonymous, hardened photo upload
- Private quarantine storage for pending photos
- Admin moderation UI (grid, fast review mode, bulk actions, kill switch, QR generator)
- Approve → existing `Media` + `CampaignMedia` → existing player
- Removal of campaigner/client login surface; admin-only authentication retained

**Out of scope (v1)**
- Video uploads, HEIC decoding on the server, contributor accounts
- AI/NSFW auto-moderation (human approval is the only gate)
- Changes to the player/display rendering logic (touch only if T0 proves it is required)

---

## 2. Baseline: what is verified vs. assumed

**Verified from the repository README**

| Fact | Implication |
|---|---|
| Monorepo: `apps/web` (Next.js 16, React 19), `apps/display` (static HTML player), `packages/database` (`@vaart/database`, Prisma 5 → PostgreSQL), `packages/storage` (R2 helpers) | New code lives in `apps/web` + small additions to `packages/database` and `packages/storage` |
| Auth.js / NextAuth v5, JWT sessions, Credentials provider; roles Admin / Campaigner | Keep for admin; block campaigner sign-in |
| Route protection in `apps/web/proxy.ts`, coarse only; per-action role checks are inside API routes | Every new admin route must self-enforce `ADMIN` |
| Storage: Cloudflare R2, **or local disk under `apps/web/public/uploads/`** | `public/` is world-readable → pending photos must **never** go there |
| TVs pull playlists over HTTP; Pusher realtime is optional; without Pusher, TVs poll | Approval must trigger the existing refresh path; polling fallback already exists |
| Seeded dev logins `admin@vaart.com / Admin@123`, `client@example.com / Client@123` | **Must be rotated/removed before the app is reachable from the internet** |
| `prisma migrate dev` will try to reset the DB (one migration missing from git) → use `migrate deploy` | New migration is hand-written, applied with `migrate deploy` |
| `Media.sizeBytes` is `bigint` in DB but `Int` in schema; BigInt breaks JSON serialisation | No `BigInt` in any new model/response |

**Assumed — T0 must confirm and record in `docs/gallery/AUDIT.md`**
- Exact Prisma models/fields: `User`, `Media`, `Campaign`, `CampaignMedia` (order + duration), `TV`/`ScreenAssignment`, enums (media status, campaign status, role)
- Whether `(campaignId, order)` is unique on `CampaignMedia`
- Playlist endpoint path, poll interval, Pusher channel/event names, and the helper that publishes "playlist changed"
- Storage helper API and how an image `Media` row's public URL / `r2Key` is derived
- `proxy.ts` matcher; how the session exposes `role`
- Which `/api/*` routes are reachable unauthenticated (the app is about to become internet-facing)

---

## 3. Design principles

1. **Submission ≠ publication.** Anonymous input can only create a `PENDING` row. Only an authenticated admin action creates `Media`/`CampaignMedia`.
2. **Additive only.** New tables/enum/routes. No edits to existing tables, no deleted enums/users/relations.
3. **Server enforces everything.** Hidden buttons are not access control.
4. **Pending content is private.** Stored outside any public path/prefix; served only through an admin-authenticated route.
5. **Boring tech, few deps.** Allowed new deps: `sharp`, `qrcode`, and `zod` (if absent). Nothing else without a `DECISIONS.md` entry.
6. **Degrade gracefully.** Works with local disk and without Pusher, like the base app.
7. **Webview-friendly.** QR scans often open in in-app browsers: no cookie/localStorage dependency on the public page.

---

## 4. System context

```
 Student phone ──scan QR──► https://<host>/contribute/<slug>      (no login)
        │
        ▼
 ┌────────────────────────── Next.js (apps/web) ─────────────────────────────┐
 │ PUBLIC   /contribute/[slug]                                               │
 │          /api/contribute/[slug]/session   /api/contribute/[slug]/photos   │
 │ ADMIN    /admin/gallery/**        /api/admin/gallery/**   (role = ADMIN)  │
 │ DEVICE   /player  /display        playlist + heartbeat APIs  (unchanged)  │
 └───────┬──────────────────────────────┬──────────────────────────┬─────────┘
         │ Prisma                       │ StorageDriver            │ Pusher (opt.)
         ▼                              ▼                          ▼
    PostgreSQL             PRIVATE  .data/gallery/**  |  R2 gallery/pending/*   TV players
                           PUBLIC   existing media location (on approval)       (poll / push)
```

### Trust zones and route matrix

| Route | Method | Zone | Auth | Purpose |
|---|---|---|---|---|
| `/contribute/[slug]` | GET | Public | none | Upload page (noindex) |
| `/api/contribute/[slug]/session` | GET | Public | none | Event state, limits, short-lived upload token |
| `/api/contribute/[slug]/photos` | POST | Public | upload token + rate limit | Upload **one** photo per request |
| `/admin/gallery/**` | GET | Admin | session `ADMIN` | Moderation UI |
| `/api/admin/gallery/events` | GET, POST | Admin | `requireAdmin()` | List / create events |
| `/api/admin/gallery/events/[id]` | PATCH | Admin | `requireAdmin()` | Open/close, limits, target campaign |
| `/api/admin/gallery/events/[id]/stats` | GET | Admin | `requireAdmin()` | Pending/approved/rejected counts (polled) |
| `/api/admin/gallery/events/[id]/photos` | GET | Admin | `requireAdmin()` | Cursor-paginated list by status |
| `/api/admin/gallery/photos/[id]/image` | GET | Admin | `requireAdmin()` | Stream `?v=thumb\|full` (private) |
| `/api/admin/gallery/photos/[id]/approve` | POST | Admin | `requireAdmin()` | Publish to campaign |
| `/api/admin/gallery/photos/[id]/reject` | POST | Admin | `requireAdmin()` | Reject (+reason) |
| `/api/admin/gallery/photos/[id]/remove` | POST | Admin | `requireAdmin()` | Unpublish an approved photo |
| `/api/admin/gallery/photos/bulk` | POST | Admin | `requireAdmin()` | Bulk approve/reject/remove |
| `/api/health` | GET | Public | none | Liveness (no secrets, no DB detail) |

---

## 5. Data model

All new; **no changes to existing tables**. References to existing rows are plain string columns (validated in code inside transactions) so existing Prisma models need no back-relations and the migration cannot disturb them.

```prisma
enum GalleryPhotoStatus {
  PENDING
  APPROVED
  REJECTED
  REMOVED      // was approved, later unpublished
}

model GalleryEvent {
  id                 String   @id @default(cuid())
  slug               String   @unique            // e.g. "navaratri-2026"
  name               String
  campaignId         String                       // target Campaign (existing table)
  isOpen             Boolean  @default(true)      // kill switch for intake
  maxFilesPerRequest Int      @default(5)         // client-side batch cap
  maxFileBytes       Int      @default(10485760)  // 10 MB raw upload cap
  maxPending         Int      @default(500)       // intake pauses when reached
  perTokenCap        Int      @default(30)        // photos per upload token
  displaySeconds     Int      @default(8)         // CampaignMedia duration on approve
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  photos             GalleryPhoto[]
}

model GalleryPhoto {
  id              String             @id @default(cuid())
  eventId         String
  event           GalleryEvent       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  status          GalleryPhotoStatus @default(PENDING)

  storageKey      String             // private full-size key (re-encoded JPEG)
  thumbKey        String             // private thumbnail key
  width           Int
  height          Int
  sizeBytes       Int                // Int, never BigInt
  sha256          String             // of the re-encoded full-size bytes

  contributorName String?            // optional, max 60 chars
  caption         String?            // optional, max 140 chars
  consentAt       DateTime
  ipHash          String             // HMAC(ip, GALLERY_IP_SALT), truncated; no raw IPs stored
  createdAt       DateTime           @default(now())

  reviewedById    String?            // User.id of admin (plain string)
  reviewedAt      DateTime?
  rejectReason    String?
  mediaId         String?            @unique   // resulting Media.id
  campaignMediaId String?            @unique   // resulting CampaignMedia.id

  @@unique([eventId, sha256])        // silent de-dupe of identical photos
  @@index([eventId, status, createdAt])
}
```

### Migration procedure (important — repo has drift)

1. **Do not run `prisma migrate dev`.** It will propose resetting the database.
2. Hand-write `packages/database/prisma/migrations/<timestamp>_gallery/migration.sql` (`CREATE TYPE`, `CREATE TABLE`, `CREATE UNIQUE INDEX`, `CREATE INDEX`, FK to `GalleryEvent`).
3. Verify with `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` — the **only** remaining diff must be the pre-existing `Media.sizeBytes` drift. Anything else = fix the SQL.
4. Apply with `prisma migrate deploy`; then `prisma generate`.

---

## 6. Storage design

Add a **private namespace** to `packages/storage`:

```ts
interface PrivateStore {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Buffer; contentType: string }>;
  delete(key: string): Promise<void>;
}
```

| Driver | Pending location | Notes |
|---|---|---|
| Local | `apps/web/.data/gallery/<key>` (git-ignored, **outside** `public/`) | Path-traversal guard: resolve + assert prefix |
| R2 | `gallery/pending/<key>` in the same bucket | Never exposed via `R2_PUBLIC_URL`; no public bucket rule on this prefix |

Keys are server-generated: `<eventId>/<uuid>.jpg` and `<eventId>/<uuid>.thumb.jpg`. The uploader's filename is **never** used.

**Approval promotes** the full-size file into the *existing* media storage path (using the existing helper that creates image `Media`), so the player sees a normal media asset. The pending copy is deleted after a successful commit. Thumbnails stay private (admin-only).

---

## 7. Public ingestion pipeline

### 7.1 Client (`/contribute/[slug]`, mobile-first)

1. On mount: `GET /session` → `{ open, name, limits, token }`. Token is HMAC-signed, valid 6 h, sent as `X-Gallery-Token` (header, not cookie).
2. File input: `accept="image/jpeg,image/png,image/webp"`, `multiple`, camera or gallery.
3. Per file: decode with `createImageBitmap(file, { imageOrientation: 'from-image' })`, downscale to max edge **2560 px**, re-encode JPEG q≈0.85 via canvas. Shrinks 5–12 MB phone photos to ~0.5–1.5 MB (fast on mobile data) and sidesteps most HEIC issues on iOS. On decode failure, send the original if ≤ `maxFileBytes`.
4. Thumbnails with remove buttons; optional name/caption; **consent checkbox required**; hidden honeypot field.
5. Upload **sequentially or max 2 concurrent**, one photo per POST, per-file progress, auto-retry with backoff on network errors/503, clear success state ("Sent for review — thanks!").

### 7.2 Server `POST /api/contribute/[slug]/photos` (Node runtime)

Multipart fields: `file` (1), `consent=true`, optional `name`, `caption`, `hp` (honeypot, must be empty).

```
 1  event = find by slug; 404 if missing; 403 EVENT_CLOSED if !isOpen
 2  verify X-Gallery-Token (HMAC, slug match, age < 6h)            → 401 BAD_TOKEN
 3  rate limit: ip-hash 20 / 10 min, token ≤ perTokenCap, global 120 / min → 429 + Retry-After
 4  pending cap: count(PENDING) ≥ maxPending                       → 503 INTAKE_FULL
 5  Content-Length > maxFileBytes + 64 KB                           → 413 TOO_LARGE   (before reading body)
 6  parse multipart; require consent==="true"; hp empty; sanitize name/caption (trim, strip control chars, length caps)
 7  sniff magic bytes: JPEG FF D8 FF · PNG 89 50 4E 47 0D 0A 1A 0A · WEBP "RIFF"....“WEBP”   → 415 BAD_TYPE
 8  acquire processing semaphore (max 3 concurrent) else 503 BUSY
 9  sharp pipeline (15 s timeout):
      sharp(buf, { limitInputPixels: 50_000_000, failOn: 'error', sequentialRead: true })
        .rotate()                                   // apply EXIF orientation
        .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })       // re-encode; metadata (EXIF/GPS) dropped by default
      thumb: same input → 480 px max edge, JPEG q70
10  sha256(output); if (eventId, sha256) exists → return 200 { id, duplicate: true } (no new row)
11  private.put(full), private.put(thumb)
12  INSERT GalleryPhoto(PENDING, consentAt=now, ipHash)           → 201 { id }
```

Failures are uniform JSON `{ "error": "<CODE>" }`; never echo internal messages or stack traces. If step 12 fails, delete the stored objects (best-effort cleanup).

### 7.3 Limits (defaults; event row overrides)

| Limit | Default |
|---|---|
| Accepted types | JPEG, PNG, WebP |
| Raw file size | 10 MB |
| Decoded pixels | 50 MP |
| Output | JPEG, max edge 2560, thumb 480 |
| Per IP-hash | 20 uploads / 10 min |
| Per token | 30 photos |
| Global | 120 uploads / min |
| Pending cap | 500 |
| Processing concurrency | 3 (`sharp.concurrency(2)`) |

Rate limiter: in-memory sliding window (single-instance deployment). Client IP resolution is a single util `getClientIp()`: reads `cf-connecting-ip` only if `TRUST_CF_HEADER=true`, otherwise the socket/first `x-forwarded-for` hop.

---

## 8. Moderation

### 8.1 State machine

```
PENDING ──approve──► APPROVED ──remove──► REMOVED ──approve──► APPROVED
   │                                                    
   └──reject──► REJECTED ──approve──► APPROVED
```

### 8.2 Approve algorithm (idempotent, race-safe)

```
approve(photoId, adminId):
  photo = load; event = load; campaign = load(event.campaignId)       // 404 if gone
  1. claim:  UPDATE GalleryPhoto SET status='APPROVED', reviewedById, reviewedAt
             WHERE id=:id AND status IN ('PENDING','REJECTED','REMOVED')
     count == 0 → if status already APPROVED: return 200 { alreadyApproved: true }; else 409
  2. promote file: copy private full-size → existing media storage (key derived from photo.id → idempotent)
  3. transaction:
       SELECT pg_advisory_xact_lock(hashtext(:campaignId))            // serialise order assignment
       media  = create Media { userId: adminId, type: IMAGE, status: READY, url/r2Key, mime, sizeBytes, ... }   // fields per T0
       order  = coalesce(max(CampaignMedia.order WHERE campaignId), -1) + 1
       cm     = create CampaignMedia { campaignId, mediaId, order, durationSeconds: event.displaySeconds }
       update GalleryPhoto set mediaId, campaignMediaId
  4. on tx failure: revert status to previous value, delete promoted file, return 500
  5. after commit: delete private full-size (keep thumb); call existing "playlist changed" notifier for the campaign
```

- **Reject:** `status='REJECTED'`, store optional reason. Never touches Media/Campaign.
- **Remove:** if `campaignMediaId` set → delete that `CampaignMedia` row (and the `Media` row + promoted file if no other campaign references it), set `REMOVED`, notify. Does not touch other campaigns.
- **Bulk:** loops the single-item functions with a cap of 50 ids/request; per-item result array.
- Every admin mutation re-checks the session role server-side.

---

## 9. Display integration

- Admin creates one gallery campaign (status `ACTIVE`, created by admin so it bypasses any campaigner-approval flow) and assigns it to TVs through the **existing** assignment UI. Event row stores that `campaignId`.
- Approval/removal calls the **same notifier** the CMS already uses when a campaign changes (Pusher if configured). Without Pusher, TVs pick changes up on their existing poll cycle — T0 records the interval; if > 30 s, expose it as a setting rather than editing player code.
- Playlist ordering: approvals append (`max(order)+1`); admin can reorder with the existing campaign-media editor.
- Images are stored at ≤ 2560 px so TV players preload them quickly; the player must render `IMAGE` media with a duration (T0 verifies; the base product is video-centric).
- **Do not modify** player/display code unless T0 shows images or live refresh don't work; any change goes through `DECISIONS.md`.

---

## 10. Admin UI

Pages (Tailwind 4, existing admin layout/components reused):

| Page | Contents |
|---|---|
| `/admin/gallery` | Events list, create event (name, slug, target campaign, limits) |
| `/admin/gallery/[eventId]` | Header: counts, **Pause/Resume submissions** (big toggle), QR panel. Tabs: Pending · Approved · Rejected · Removed. Thumbnail grid with multi-select + bulk Approve/Reject. Click → full preview |
| `/admin/gallery/[eventId]/review` | Full-screen queue, one photo at a time. **A** approve · **R** reject · **Z** undo last · **←/→** skip/back. Auto-advances; preloads next 3 |

- **Notification:** poll `/stats` every 5 s; sidebar badge shows pending count; document title shows `(12) Gallery`; optional sound on increase. If Pusher is configured, additionally subscribe to a private admin channel (`gallery-<eventId>`) for instant events — optional, polling remains the baseline.
- **QR panel:** shows the public URL, Copy, and Download PNG (1024 px) / SVG using `qrcode`, error-correction **H**, quiet zone ≥ 4 modules; prints the short URL as text under the code.
- Optimistic UI with rollback on error; every action shows a toast; Undo for last approve/reject.

---

## 11. Authentication & hardening changes

| Change | Detail |
|---|---|
| Admin-only sign-in | In the Credentials `authorize()` callback reject any user whose role ≠ `ADMIN`. Keep enum values, existing rows and relations intact |
| Campaigner surface | `/dashboard` redirects admins to `/admin`, non-admins to `/login`; hide campaigner links/nav and user-management creation of campaigners; no account creation routes reachable publicly |
| Credentials | Production bootstrap from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env; **remove** the seeded `Admin@123` and `Client@123` accounts outside dev |
| Login brute force | Rate-limit `/login` credential attempts (5 / 15 min per IP+email) |
| `requireAdmin()` | Shared helper used by every `/api/admin/gallery/**` handler: 401 if no session, 403 if role ≠ ADMIN |
| Headers | `/contribute/**`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`, CSP `default-src 'self'; img-src 'self' blob: data:` (adjust for fonts) |
| `proxy.ts` | Public routes (`/contribute`, `/api/contribute`, `/api/health`, player/display APIs) must not be intercepted; confirm matcher so upload bodies bypass proxy |
| Secrets | `GALLERY_TOKEN_SECRET`, `GALLERY_IP_SALT`: ≥ 32 random bytes, never committed |
| Privacy | EXIF/GPS stripped by re-encode; no raw IPs stored; contributor name optional; consent text states photos may be shown on campus screens; admin can remove any photo at any time |

Anonymous uploads cannot prove the sender is a student. Anyone with the URL can submit; mandatory moderation + intake caps are the control.

---

## 12. Configuration

New env vars (`apps/web/.env.local`):

| Variable | Required | Purpose |
|---|---|---|
| `GALLERY_TOKEN_SECRET` | yes | HMAC key for upload tokens |
| `GALLERY_IP_SALT` | yes | HMAC key for IP hashing |
| `GALLERY_PRIVATE_DIR` | no | Local private dir (default `apps/web/.data/gallery`) |
| `PUBLIC_BASE_URL` | yes | Origin used in QR / contribute link |
| `TRUST_CF_HEADER` | no | `true` when behind Cloudflare Tunnel/proxy |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | prod | Admin bootstrap (replaces default seed) |

Existing variables are unchanged.

---

## 13. Deployment and event-day operations

Students will usually be on mobile data or college Wi-Fi, so the server must be reachable from the **public internet**. A LAN IP (`192.168.x.x`) works for TVs only.

| Option | Setup | Pros / cons |
|---|---|---|
| **A. Event laptop/PC + Cloudflare Tunnel** | `next build && next start` (not `dev`), Postgres local, local disk storage, **named** tunnel on a domain you control | Fastest; QR is stable because the hostname is fixed. Single point of failure (power, sleep, Wi-Fi). Quick-tunnel (`trycloudflare.com`) URLs change on restart — **never print a QR for a quick-tunnel URL** |
| **B. Small VPS / PaaS + managed Postgres + R2** | Deploy built app; R2 for storage; Pusher optional | More reliable, survives a laptop dying; more setup |

Event-day checklist (full version goes in `docs/gallery/RUNBOOK.md`): disable sleep, process manager (PM2) with auto-restart, DB backup before event, test QR on one iPhone and one Android over mobile data, verify TVs show an approved test photo within the expected refresh time, know where the **Pause submissions** toggle is, keep a printed fallback URL beside the QR.

---

## 14. Testing and acceptance

**Automated**
- Image pipeline: valid JPEG/PNG/WebP pass; renamed `.exe`/`.svg`/`.html` rejected; truncated JPEG; polyglot file; 30000×30000 PNG (pixel limit); EXIF GPS removed; orientation applied
- Approve: 10 concurrent approvals of one photo → exactly one `Media` and one `CampaignMedia`; 5 concurrent approvals of different photos → distinct sequential `order` values
- Authz sweep: unauthenticated request to **every** `/api/admin/gallery/**` route → 401; non-admin → 403
- Intake guards: closed event, bad token, honeypot, rate limit, pending cap, missing consent

**Manual (before the event)**
- iPhone Safari + Android Chrome, mobile data, via the QR
- Upload 5 photos, reject 1, approve 4; confirm 4 appear on the real TV within refresh window; reject never appears
- Pause submissions → upload fails with a friendly message; resume → works
- Existing campaigns and unrelated TVs unaffected

**Acceptance criteria**
1. Student scans QR and submits without an account.
2. Photo is private and absent from every playlist until approved.
3. Only the authenticated admin can view pending photos or approve/reject/remove.
4. Approval yields exactly one media entry in the target campaign.
5. Approved photo reaches the assigned screen per the player's refresh behaviour.
6. Rejected/removed photos are absent from every display.
7. Intake can be paused instantly.
8. No seeded default credentials exist on the internet-facing instance.

---

## 15. Phasing

| Priority | Scope | Tasks |
|---|---|---|
| **P0 — must ship** | Audit, schema, private storage, image pipeline, guards, public API + page, admin API, approve/reject/remove, basic admin UI (grid + approve/reject + pause + QR), auth lock-down, runbook | T0–T10, T12 |
| **P1 — should ship** | Review mode with hotkeys, bulk actions, stats badge/polling polish, full test suite | T9 extras, T11 |
| **P2 — later** | Pusher admin push, IP-hash blocklist, captions on display, HEIC server decode, multi-language page, event templates | — |
