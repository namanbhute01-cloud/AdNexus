# DECISIONS — Community Gallery

Each entry: decision · alternatives considered · reason. Recorded per INSTRUCTIONS §3 whenever a choice was ambiguous or deviated from `ARCHITECTURE.md`.

---

## D1 — Add a content poll to the player and the standalone display  *(INSTRUCTIONS hard rule 6 exemption)*

**Decision.** Add a periodic re-fetch of `/api/display/content` to `apps/web/components/device-player.tsx` and `apps/display/index.html`, defaulting to **15 s**, driven by an existing-style `setInterval`. Pusher push remains the low-latency path; polling is the floor.

**Alternatives.**
1. Require Pusher for the event.
2. Force the player to be manually reloaded by the admin after every approval.
3. Leave the player untouched (the literal reading of ARCHITECTURE §1 "out of scope").

**Reason.** ARCHITECTURE §2 claimed TVs poll when Pusher is absent. T0 disproved it: `device-player.tsx:91` fetches once on mount, and the only interval in that effect (`:92`) posts a heartbeat and discards the response; `apps/display/index.html:73` is identical. With Pusher unconfigured — the default, and the documented "degrades gracefully" path — an approved photo would **never** appear on a screen, failing acceptance criterion 5 and the entire point of the event. INSTRUCTIONS rule 6 explicitly says "**unless T0 proves it is required**". T0 proved it. This is the one sanctioned player change.

**Scope limit.** The change is strictly additive: one extra `fetchContent()` on an interval plus a `visibilitychange` re-fetch when the tab regains focus. No change to rendering, playlist shape, channel names, or auth.

---

## D2 — Author a campaign → TV notifier instead of "reusing" one

**Decision.** Add `apps/web/lib/display-notifier.ts` exporting `notifyCampaignPlaylistChanged(campaignId: string)`. It resolves active `ScreenAssignment`s for the campaign, loads the playlist once via the existing `getPlaylistForCampaign()`, and triggers the existing `content-update` event on each TV's existing `tv-${serial}-${subSerial}` channel. Guarded by the same `hasPusherConfig()` check. Wrapped in try/catch — Pusher failure must never fail an approval.

**Alternatives.**
1. Push a campaign-level channel and add a second subscription to the player — requires player changes *and* a breaking channel change.
2. Inline the trigger inside `publish.ts` — untestable and duplicates it again for the admin UI.
3. Do nothing and rely on the D1 poll.

**Reason.** ARCHITECTURE §8.2 step 5 and INSTRUCTIONS T8 both say "reuse the existing notifier". T0 found none: `app/api/admin/assignments/route.ts:7` constructs Pusher inline and triggers only for assignment create/delete, on **per-TV** channels. The player already binds `content-update` on exactly that channel (`device-player.tsx:123`), so fanning out to the same channel/event needs **zero player changes** — which keeps D1 as the only player touch. Polling (D1) still covers the Pusher-less case.

---

## D3 — Promote approved photos to `uploads/gallery/<eventId>/<photoId>.jpg`

**Decision.** On approval, copy the private full-size JPEG into the **existing local media directory** — `apps/web/public/uploads/gallery/<eventId>/<photoId>.jpg` — and set `r2Key = "uploads/gallery/<eventId>/<photoId>.jpg"`, `url = "/uploads/gallery/<eventId>/<photoId>.jpg"`, exactly matching `app/api/media/route.ts:24`'s `uploads/`-prefix branch.

**Alternatives.**
1. R2-only promotion (S3 `CopyObject`/`PutObject`).
2. Introduce a new public `gallery/` prefix and a new URL rule.

**Reason.** The key is derived deterministically from `photoId`, so a retried or concurrent approval writes the same path — that is what makes approve idempotent at the storage layer and satisfies INSTRUCTIONS "10 parallel approvals → exactly 1 Media". `uploads/` is the only prefix the existing `/api/media` DELETE cleanup and URL derivation already understand. When R2 *is* configured, the same helper writes `gallery/approved/<eventId>/<photoId>.jpg` and builds `url` from `R2_PUBLIC_URL`, reusing the existing branch. Both drivers share one `MediaStorageAdapter` with the local driver as the default, matching the base app's "degrades gracefully" rule.

---

## D4 — `CampaignMedia.displayTime`, not `durationSeconds`

**Decision.** `GalleryEvent.displaySeconds` is written to `CampaignMedia.displayTime` (`schema.prisma:119`), which `getPlaylistForCampaign` already surfaces as `duration` for `IMAGE` rows (`campaign-playlist.ts:29`), which `ImageFrame` already honours (`device-player.tsx:348`).

**Reason.** Pure naming reconciliation from T0. No behaviour change.

---

## D5 — Tests run on `node:test` + `tsx`; no test-runner dependency

**Decision.** Unit tests are `node:test` files executed via `pnpm --filter web test:gallery` → `tsx --test`. `tsx` is added to `apps/web` devDependencies (it is already used repo-wide by `packages/database` and `smoke-test.ts`). Fixtures are generated in-process with `sharp` — no binary assets committed.

**Alternatives.** `vitest` or `jest`.

**Reason.** INSTRUCTIONS rule 7 allows only `sharp`, `qrcode`, `zod` as new dependencies. `node:test` ships with Node ≥ 20.9 (already the repo floor) and needs nothing. `vitest` would be a hard, permanent, transitive-dependency addition purely for convenience.

---

## D6 — Local private store lives at `apps/web/.data/gallery`

**Decision.** `GALLERY_PRIVATE_DIR` defaults to `<cwd>/.data/gallery`, i.e. `apps/web/.data/gallery`. Add `.data/` to `.gitignore`.

**Reason.** Never under `public/` — `public/` is world-readable (rule 4). `.data/` is outside the Next.js static root entirely. Every key is resolved and asserted to stay inside the base dir.

---

## D7 — Campaigner sign-in is blocked at `authorize()`, campaigner *rows* survive

**Decision.** `apps/web/auth.ts` `authorize()` returns `null` unless `user.role === "ADMIN"`. The `CAMPAIGNER` enum value, the seeded `client@example.com` row, `/dashboard` pages, and `CampaignerEVAccess` are all left untouched in the database. `/admin/layout.tsx`'s "not ADMIN → `/dashboard`" redirect is retargeted to `/login`. Campaigner nav links are removed from the admin shell and `proxy.ts`'s logged-in-on-`/login` redirect goes to `/admin`.

**Reason.** INSTRUCTIONS T10 forbids deleting enum values or DB rows, and ARCHITECTURE §11 says "keep existing rows and relations intact". Blocking at `authorize()` means a stale campaigner session cookie still authenticates against `auth()` but every `/api/admin/**` route already re-checks `role` — and T10 adds `requireAdmin()` to every gallery route.

---

## D8 — Login rate limit is in-memory, 5 / 15 min per (IP + email)

**Decision.** Reuse the T4 sliding-window limiter. Documented as best-effort: it resets on restart and is per-process.

**Reason.** Single-instance event deployment (ARCHITECTURE §13 option A). A shared Redis store would be a new dependency and infrastructure for one evening. Acceptable because the admin password is long and the exposure window is bounded.

---

## D9 — Gallery `campaignId` is required at event creation

**Decision.** `GalleryEvent.campaignId` is non-null. Creating an event without a target campaign is rejected by `zod`.

**Alternatives.** Allow a null campaign and require it later at approval time.

**Reason.** It makes "approve" a single transaction with no partial state, and the admin flow is: create the campaign once in `/admin/campaigns`, then create the event pointing at it. The extra step is a one-time setup cost for a clear failure mode.

---

## D10 — De-duplication returns the existing row and does not create a new one

**Decision.** `@@unique([eventId, sha256])` is enforced in the database. On conflict the API returns `200 { id, duplicate: true }` pointing at the original photo.

**Reason.** Two students photographing the same printed poster, or one student re-sending after a flaky network, must not fill the moderation queue. Hashing the **re-encoded** output (not the original bytes) is what makes this reliable — two different source photos that normalise to the same bytes are genuinely the same picture.

---

## D11 — In-memory rate limiting is accepted as-is for v1

**Decision.** Single-process sliding window in `apps/web/lib/gallery/rate-limit.ts`, matching ARCHITECTURE §7.3.

**Reason.** Event deployment is one Node process. Documented in RUNBOOK as a known limitation if the app is ever scaled horizontally.