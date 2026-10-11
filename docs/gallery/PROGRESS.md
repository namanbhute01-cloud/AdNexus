# Progress — Community Gallery

Branch `feat/community-gallery`. One commit per task, `gallery(Tn): <summary>`.

---

### T0 — Audit
`docs/gallery/AUDIT.md`, `docs/gallery/DECISIONS.md`.
Verified Prisma models/fields/enums, migrations, auth, the full `/api/**` route
table, storage, and the player. **Two assumptions in `ADNEXUS_ARCHITECTURE.md`
were factually wrong about this repo:**

- **F1** — the player fetched its playlist exactly once on mount
  (`device-player.tsx:91`). The only interval posts a heartbeat. ARCHITECTURE §9
  claimed TVs poll; they do not. Without Pusher an approved photo never reaches
  a screen.
- **F2** — no "playlist changed" notifier exists to reuse. Pusher is inline in
  `admin/assignments/route.ts` and only fires for assignment changes.

Also recorded F3 (device routes trust guessable serials), F9 (public/ is
snapshotted at server start) and 10 out-of-scope findings.

### T1 — Schema + migration
Added `GalleryEvent`, `GalleryPhoto`, `GalleryPhotoStatus`; hand-wrote
`20261011000000_gallery`. Applied with `migrate deploy` (never `dev`).
`migrate diff` afterwards shows **only** the known `Media.sizeBytes` drift.
Backed up the DB first. `smoke-test.ts` still passes.
Seed helper: `packages/database/scripts/create-gallery-event.ts`.

### T2 — Private storage
`PrivateStore` in `packages/storage` with a local driver (`.data/gallery`,
git-ignored) and an R2 driver (`gallery/pending/`). Key-shape validation blocks
traversal before anything touches disk or a bucket.
`@vaart/storage` had to be wired into `apps/web` (broken `main`, not linked);
mirrors the existing `@vaart/database` pattern.
**A test caught a real bug**: the key pattern rejected the `.thumb.jpg` variant
ARCHITECTURE §6 requires. 23 assertions green.

### T3 — Image pipeline
Magic-byte sniff, 50 MP ceiling, EXIF rotate + strip, 2560 px JPEG, 480 px thumb,
sha256 of the re-encoded bytes, 3-way semaphore, 15 s timeout.
Benchmarked on the target 2-core box and applied two free wins: dropped
`sequentialRead` (25% faster, byte-identical output) and derived the thumbnail
from the downscaled full instead of decoding the original twice.
A realistic 12 MP phone photo processes in ~830 ms; a regression test guards it.

### T4 — Guards
`env`, `upload-token`, `rate-limit`, `client-ip`, `sanitize`, `require-admin`.
**A test caught a real bug**: control characters were stripped before whitespace
collapsing, so `"line\nbreak"` became `"linebreak"`. Fixed. 52 assertions green.

### T5 — Public API
`GET /api/contribute/[slug]/session`, `POST .../photos` (the 12-step flow).
Verified against a production build: 201 / 200-duplicate / 415 / 400 / 401 / 403,
and quarantined photos 404 on every conceivable public path.

### T6 — Contribution page
Mobile-first, no cookie or localStorage dependence, browser-side downscale,
per-file progress via XHR, exponential backoff, honeypot, full friendly error
states. Security headers in `next.config.ts`.

### T7 — Admin API
Events CRUD, stats, cursor-paginated list, private image streaming,
approve/reject/remove, bulk. All behind `requireAdmin()`.

### T8 — Publish service + notify
Approval is idempotent via three independent mechanisms (CAS claim,
deterministic destination key, `Media.r2Key @unique`), with order assignment
serialised by `pg_advisory_xact_lock` because `CampaignMedia` is **not** unique
on `(campaignId, order)`.
Verified: 10 parallel approvals → exactly one `Media` and one `CampaignMedia`;
5 parallel approvals → 5 distinct sequential orders.
Wrote `notifyCampaignPlaylistChanged` (D2) using the channel/event names the
player already binds, so no further player change was needed.

### D1/D2 — Player
Added a 15 s content poll plus a `visibilitychange` re-fetch, with a fingerprint
guard so playback is not restarted when the playlist is unchanged. Same fix in
`apps/display/index.html`. This is the one sanctioned player change (rule 6:
"unless T0 proves it is required" — it did).

### T10 — Auth lock-down
`authorize()` rejects non-ADMIN; login rate limiter; `/api/health`; production
seed no longer creates default accounts; redirects fixed (no loops); campaigner
nav removed, Gallery nav added. Added `gallery-authz-sweep.ts`.
Verified: campaigner `Client@123` → rejected; admin → 200 on every gallery route;
anonymous → 401 on all 10.

### T9 — Admin UI
Events list, moderation grid with 5 s polling and tab counts, prominent
Pause/Resume, QR panel (ECC H, 1024 px PNG + SVG), review mode with A/R/Z/arrows.
**Three real bugs were found only by running the stack, not by unit tests:**
- F9 (blocker) — Next.js snapshots `public/` at **server start**, so media
  written while running 404s until a restart. Fixed with a public read-only
  `/media/[...path]` route (D13); traversal payloads all 404.
- F10 — `removePhoto` read the `Media` row after deleting it, orphaning the file.
- `promoteGalleryPhoto` located its source by re-deriving a filename from
  `photo.id` while uploads store under a random UUID. The unit test had been
  masking this by writing its fixture to match the wrong side.
All three now have regression tests.

### T11 — Smoke + authz scripts
`smoke:gallery` (28 assertions, self-contained and safe on a live box) and
`authz:sweep`. Both green.

### T12 — Docs
`RUNBOOK.md`, root `.env.example`, README section.

---

## Current state

| | |
| --- | --- |
| Unit + integration | 60 passing |
| Image pipeline | 22 assertions passing |
| End-to-end smoke | 28 passing |
| Authz sweep | 24 routes, all as intended |
| `tsc --noEmit` | clean |
| `lint` | clean |
| Existing `smoke-test.ts` | passes |

### Test totals
```
pnpm --filter web test:gallery
pnpm --filter web exec tsx tests/gallery/image-pipeline.test.ts
pnpm --filter web build && pnpm --filter web start   # then, in another shell:
pnpm --filter web smoke:gallery
pnpm --filter web authz:sweep
```

### Known gaps
See `DECISIONS.md` (D1–D13) and `AUDIT.md` §0. The two that matter operationally:
Pusher is not configured by default, so screens rely on the 15 s poll; and the
pre-existing CMS upload path still has the F9 snapshot limitation (gallery media
does not — it uses the `/media/` route).