# Community Gallery — Event Runbook

Operator guide for the Community Gallery. Follow it top to bottom the first time.
The thing that matters most: **run a production build, never `pnpm dev`.**

---

## 1. What this is

Students scan a QR code, upload photos with **no account**, and an admin approves
or rejects each one. Approved photos appear on the campus screens through the
existing CMS pipeline. Unapproved photos are invisible to everyone, including
other students.

Full design rationale: [`ARCHITECTURE.md`](ARCHITECTURE.md).
Audit of the existing repo: [`AUDIT.md`](AUDIT.md).
Every deviation from the spec: [`DECISIONS.md`](DECISIONS.md).

---

## 2. One-time setup

### 2.1 Requirements

- Node.js **>= 20.9**, pnpm 9+, PostgreSQL 14+
- A machine reachable from the **public internet** (see §6)

### 2.2 Install

```bash
git checkout feat/community-gallery
pnpm install
```

### 2.3 Environment

Copy `.env.example` values into `apps/web/.env.local`. The gallery needs four:

```bash
# Generate the two secrets — never reuse, never commit them
openssl rand -hex 32   # GALLERY_TOKEN_SECRET
openssl rand -hex 32   # GALLERY_IP_SALT
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `GALLERY_TOKEN_SECRET` | yes | Signs the 6-hour upload tokens. >= 32 chars. |
| `GALLERY_IP_SALT` | yes | HMAC key for IP hashing. >= 32 chars. |
| `PUBLIC_BASE_URL` | yes | The origin printed in the QR code. Must be reachable from students' phones. |
| `TRUST_CF_HEADER` | if behind Cloudflare | `true` only when the origin is unreachable except through the tunnel. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | production | Bootstraps the admin. Replaces the seeded `Admin@123`. |
| `GALLERY_PRIVATE_DIR` | no | Defaults to `apps/web/.data/gallery`. |

### 2.4 Database

```bash
cd packages/database
npx prisma migrate deploy      # NEVER `migrate dev` — it will try to reset the DB
npx prisma generate
cd ../..
```

Verify nothing was disturbed:

```bash
cd packages/database && npx tsx smoke-test.ts
```

### 2.5 Admin account (production)

```bash
cd packages/database
ADMIN_EMAIL="you@college.edu" ADMIN_PASSWORD="<at least 12 chars>" npx prisma db seed
```

The seed creates **no** development accounts in production. The old
`admin@vaart.com / Admin@123` login does not exist there.

### 2.6 Create the campaign, then the event

The campaign is *where approved photos go*; the event is *who can submit*.

```bash
# 1. In the admin UI: /admin/campaigns -> create "Navaratri 2026", set status ACTIVE.
# 2. From the CLI (faster):
cd packages/database
npx tsx scripts/create-gallery-event.ts \
  --slug navaratri-2026 \
  --name "Navaratri 2026" \
  --campaignId <the campaign id> \
  --displaySeconds 8
```

### 2.7 Assign the campaign to a screen

In `/admin/assignments`, assign the campaign to the TVs that will show the
gallery. **Approved photos do not appear on a screen that is not assigned the
campaign** — this is the single most common "why isn't my photo showing" cause.

### 2.8 Build and run

```bash
pnpm --filter web build
pnpm --filter web start
```

Keep it alive with PM2:

```bash
pm2 start pnpm --name adnexus-gallery -- start --cwd apps/web
pm2 save
pm2 startup     # run the printed command once
```

---

## 3. Before the event — verification

Run the automated checks:

```bash
pnpm --filter web test:gallery          # 60 unit/integration assertions
pnpm --filter web exec tsx tests/gallery/image-pipeline.test.ts   # 22 pipeline assertions
pnpm --filter web smoke:gallery         # 28 end-to-end assertions (needs a running server)
pnpm --filter web authz:sweep           # auth posture of every /api route
pnpm --filter web exec tsc --noEmit && pnpm --filter web lint
```

Then do it by hand. **On a real phone, over mobile data** — not office Wi-Fi:

1. Scan the printed QR with an iPhone **and** an Android phone.
2. Upload 5 photos. Watch the browser tab title become `(5) Gallery`.
3. Approve 4. Reject 1.
4. Confirm 4 photos appear on the real TV within the refresh window
   (**<= 20 s**: the poll is 15 s, plus render).
5. Confirm the rejected photo never appears.
6. Hit **Pause submissions**, try to upload again, confirm the friendly message.
   Resume, upload again, confirm it works.
7. Confirm existing campaigns and unrelated TVs are unaffected.

---

## 4. Event day

### 4.1 Print the QR

`/admin/gallery/<eventId>` → QR panel → **PNG** (1024 px) or **SVG**.

- Print at **at least 8 cm** square. Smaller will not scan reliably.
- Print on white, matte if possible. Avoid creases and window stickers.
- Put the short URL in large text underneath as a fallback for anyone who
  cannot scan.

### 4.2 Checklist

- [ ] `pnpm --filter web start` is running under PM2 (`pm2 status`)
- [ ] Machine sleep is **disabled** (Settings → Power, or `caffeinate -i`)
- [ ] Tunnel is up and the QR hostname resolves from a phone on mobile data
- [ ] `/api/health` returns `{"ok":true}`
- [ ] Admin is signed in and `/admin/gallery/<eventId>` is open on a second screen
- [ ] One approved test photo is confirmed on a real TV
- [ ] You know where **Pause submissions** is
- [ ] Printed fallback URL is beside every QR poster
- [ ] Database backup taken (`pg_dump`, §7)

### 4.3 While it runs

The admin page polls every 5 s, so the pending count and tab title update on
their own. Screens pick up changes within ~15 s automatically — you do not need
to touch the TVs.

Work through the queue with **Review mode** (`/admin/gallery/<id>/review`):
`A` approve, `R` reject, `Z` undo, arrows to navigate.

---

## 5. When something goes wrong

| Symptom | What it means | Do this |
| --- | --- | --- |
| Students say uploads fail | Server down, or tunnel down | `pm2 status`, `pm2 logs --lines 50`. If the tunnel is down, restart it and post the fallback URL. |
| Nobody can scan the QR | Phones have no internet | Post the fallback URL. If the app is only on LAN, this is the cause — it needs a public address. |
| Spam / inappropriate photos arriving | — | Hit **Pause submissions** immediately, then triage the queue. Resume when clear. |
| One photo is inappropriate and already on screen | — | `/admin/gallery/<id>` → Approved tab → **Remove**. Leaves the playlist within 15 s. |
| Approved photo not on the TV | Campaign not assigned to that screen, or TV is on another campaign | Check `/admin/assignments` for that TV. |
| Approved photo on screen but broken image | File missing from disk | Check `apps/web/public/uploads/gallery/<eventId>/`. See §5.1. |
| Queue stuck, uploads say "full" | 500 pending | Approve or reject some; `maxPending` pauses intake at 500 by design. |
| "Submissions are closed" for everyone | Paused | **Resume submissions** on the event page. |

### 5.1 If media 404s on screen

Only if you are serving local disk. `/media/uploads/gallery/...` reads from disk
per request and should always work. If a *pre-existing* `/uploads/...` URL 404s,
the file was written after the server started — see AUDIT finding F9. A server
restart fixes it; approved gallery photos are not affected.

---

## 6. Making it reachable from the internet

Students are on mobile data or college Wi-Fi. A LAN IP works for the TVs only.

**Option A — event laptop + Cloudflare Tunnel (recommended for an event)**

```bash
# A NAMED tunnel. Quick tunnels (trycloudflare.com) change URL on every
# restart — never print a QR for one.
cloudflared tunnel create adnexus-gallery
cloudflared tunnel route dns adnexus-gallery gallery.yourdomain.com
cloudflared tunnel --url http://localhost:3000 run adnexus-gallery
```

Set `PUBLIC_BASE_URL=https://gallery.yourdomain.com` and
`TRUST_CF_HEADER=true`, then restart the app.

Single point of failure: power, sleep, Wi-Fi. Plug in and disable sleep.

**Option B — VPS/PaaS.** Survives a laptop dying, more setup. Use R2 for
storage; Pusher optional.

---

## 7. Backup

Before the event, and again if anything goes wrong mid-event:

```bash
cd packages/database
PGPASSWORD=... pg_dump -h localhost -U postgres -d naarte -Fc -f ~/naarte-$(date +%F).dump
```

---

## 8. After the event

1. **Close the event** — `/admin/gallery/<id>` → Pause submissions.
2. **Keep or remove approved photos.** Removing them from the gallery leaves the
   campaign and the existing CMS media intact, which is the safe default if you
   are unsure.
3. **Delete the quarantined submissions.** Pending photos include every student
   upload that was never approved — including ones you rejected:

   ```bash
   rm -rf apps/web/.data/gallery          # pending/rejected private copies
   find apps/web/public/uploads/gallery -type f -delete   # approved public copies
   ```

   Do this only if the event is fully over; it is not reversible.
4. **Stop the tunnel** and `pm2 stop adnexus-gallery`.
5. **Rotate the admin password** if the machine was shared:

   ```bash
   cd packages/database
   npx tsx -e "
   import {prisma} from './src/index'; import bcrypt from 'bcryptjs';
   const e=process.argv[2];
   prisma.user.update({where:{email:e},data:{passwordHash:await bcrypt.hash(process.argv[3],12)}})
     .then(()=>{console.log('updated');return prisma.\$disconnect()});" you@college.edu 'new-password'
   ```

---

## 9. Troubleshooting reference

| Command | What it does |
| --- | --- |
| `pm2 status` | Is the app running? |
| `pm2 logs --lines 100` | Recent server logs (gallery errors are prefixed `[gallery]`) |
| `curl -s localhost:3000/api/health` | Liveness — should print `{"ok":true}` |
| `pnpm --filter web smoke:gallery` | Full end-to-end proof, safe on a live box |
| `pnpm --filter web authz:sweep` | Confirms no admin route is reachable anonymously |

Gallery errors in the log are prefixed `[gallery]`, e.g.
`[gallery] approve failed: ...`. The codes in the public upload API
(`BAD_TOKEN`, `INTAKE_FULL`, `TOO_LARGE`, `BAD_TYPE`, `BUSY`) map to the friendly
messages the student sees.