/**
 * End-to-end gallery smoke test.
 *
 * Drives a RUNNING server through the entire journey a real submission takes,
 * and asserts the property that actually matters on event day: a photo is
 * invisible until an admin approves it, and visible on the TV playlist after.
 *
 *   pnpm --filter web build && pnpm --filter web start
 *   pnpm --filter web smoke:gallery
 *
 * Options:
 *   --base <url>      default http://localhost:3000
 *   --admin <email>   default admin@vaart.com
 *   --password <pw>   default Admin@123
 *   --slug <slug>     create/operate on this event slug (default: smoke-<ts>)
 *   --keep            do not delete the event afterwards
 */

import "../tests/gallery/env"
import sharp from "sharp"
import { prisma } from "@vaart/database"

function arg(flag: string, fallback: string) {
  const i = process.argv.indexOf(flag)
  return i === -1 ? fallback : process.argv[i + 1]
}
const has = (flag: string) => process.argv.includes(flag)

const BASE = arg("--base", "http://localhost:3000")
const EMAIL = arg("--admin", "admin@vaart.com")
const PASSWORD = arg("--password", "Admin@123")
const SLUG = arg("--slug", `smoke-${Date.now()}`)
const KEEP = has("--keep")

let passed = 0
let failed = 0
let restoreAssignment: { id: string; campaignId: string } | null = null

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`)
  }
}

async function makeImage(seed: number, width = 640, height = 480): Promise<Buffer> {
  let state = seed >>> 0
  const px = Buffer.alloc(width * height * 3)
  for (let i = 0; i < px.length; i += 3) {
    state = (state * 1664525 + 1013904223) >>> 0
    px[i] = (state >>> 24) & 0xff
    state = (state * 1664525 + 1013904223) >>> 0
    px[i + 1] = (state >>> 24) & 0xff
    state = (state * 1664525 + 1013904223) >>> 0
    px[i + 2] = (state >>> 24) & 0xff
  }
  return sharp(px, { raw: { width, height, channels: 3 } }).jpeg().toBuffer()
}

/** Minimal cookie-jar login against Auth.js' credentials callback. */
async function login(): Promise<string> {
  const jar = new Map<string, string>()

  const absorb = (res: Response) => {
    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";")
      const eq = pair.indexOf("=")
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }

  const cookieHeader = () => Array.from(jar, ([k, v]) => `${k}=${v}`).join("; ")

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } })
  absorb(csrfRes)
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

  await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ email: EMAIL, password: PASSWORD, csrfToken, json: "true" }),
  }).then(absorb)

  const me = await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookieHeader() } })
  const session = (await me.json()) as { user?: { email?: string } }
  if (!session.user?.email) throw new Error(`Login failed for ${EMAIL}`)
  return cookieHeader()
}

async function playlist(cookie: string, serial: string, subSerial: string) {
  const res = await fetch(`${BASE}/api/display/content`, {
    headers: { cookie, "X-Serial": serial, "X-SubSerial": subSerial },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { playlist: { id: string; type: string; url: string; duration: number | null }[] }
  return data.playlist
}

async function main() {
  console.log(`Gallery smoke test against ${BASE}\n`)

  // ---------------------------------------------------------------- setup
  console.log("Setup")
  const cookie = await login()
  check("admin login", true, EMAIL)

  // Always publish into a campaign created by this run. Reusing a pre-existing
  // one would silently skip the playlist assertions if it happens not to be
  // assigned to the screen under test.
  const campaignRes = await fetch(`${BASE}/api/campaigns`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Gallery smoke ${Date.now()}` }),
  })
  check("created a campaign to publish into", campaignRes.ok, `HTTP ${campaignRes.status}`)
  const campaignId = ((await campaignRes.json()) as { id: string }).id

  const eventRes = await fetch(`${BASE}/api/admin/gallery/events`, {
    method: "POST",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Smoke Event", slug: SLUG, campaignId, displaySeconds: 5 }),
  })
  if (!eventRes.ok) throw new Error(`Could not create the event: HTTP ${eventRes.status}`)
  const event = (await eventRes.json()) as { id: string; slug: string }
  check("created gallery event", true, `${event.slug} (${event.id})`)

  // ------------------------------------------------- anonymous submission
  console.log("\nAnonymous submission")
  const sessionRes = await fetch(`${BASE}/api/contribute/${event.slug}/session`)
  const sessionBody = (await sessionRes.json()) as { open: boolean; token: string; limits: { maxFileBytes: number } }
  check("public session returns an upload token", sessionRes.ok && Boolean(sessionBody.token))

  async function upload(buffer: Buffer, fields: Record<string, string> = {}) {
    const form = new FormData()
    form.append("file", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), "photo.jpg")
    form.append("consent", "true")
    for (const [k, v] of Object.entries(fields)) form.append(k, v)
    return fetch(`${BASE}/api/contribute/${event.slug}/photos`, {
      method: "POST",
      headers: { "X-Gallery-Token": sessionBody.token },
      body: form,
    })
  }

  const a = await upload(await makeImage(1), { name: "Smoke A" })
  const aBody = (await a.json()) as { id?: string; error?: string }
  check("upload succeeds without any account", a.status === 201 && Boolean(aBody.id), aBody.error)

  const b = await upload(await makeImage(2), { name: "Smoke B" })
  const bBody = (await b.json()) as { id?: string }
  check("second upload succeeds", b.status === 201 && Boolean(bBody.id))

  const dup = await upload(await makeImage(1))
  const dupBody = (await dup.json()) as { duplicate?: boolean; id?: string }
  check("identical photo is de-duplicated", dup.status === 200 && dupBody.duplicate === true)

  const junk = await upload(Buffer.from("<script>alert(1)</script>".repeat(200)))
  check("a text file is rejected", junk.status === 415, `HTTP ${junk.status}`)

  const noConsentForm = new FormData()
  noConsentForm.append("file", new Blob([new Uint8Array(await makeImage(9))], { type: "image/jpeg" }), "p.jpg")
  const noConsent = await fetch(`${BASE}/api/contribute/${event.slug}/photos`, {
    method: "POST",
    headers: { "X-Gallery-Token": sessionBody.token },
    body: noConsentForm,
  })
  check("upload without consent is rejected", noConsent.status === 400, `HTTP ${noConsent.status}`)

  const noToken = await fetch(`${BASE}/api/contribute/${event.slug}/photos`, { method: "POST" })
  check("upload without a token is rejected", noToken.status === 401, `HTTP ${noToken.status}`)

  // ------------------------------------------------------------ privacy
  console.log("\nPrivacy")
  const anonImage = await fetch(`${BASE}/api/admin/gallery/photos/${aBody.id}/image`)
  check("anonymous cannot read a pending photo", anonImage.status === 401, `HTTP ${anonImage.status}`)

  // ------------------------------------------------------- before approval
  console.log("\nBefore approval")
  const listBefore = await fetch(`${BASE}/api/admin/gallery/events/${event.id}/photos?status=PENDING`, { headers: { cookie } })
  const listBeforeBody = (await listBefore.json()) as { photos: { id: string }[] }
  check("admin sees the pending queue", listBefore.ok && listBeforeBody.photos.length >= 2, `${listBeforeBody.photos?.length} pending`)

  // There is no API that lists TVs (`/api/admin/display-units` only does
  // POST/DELETE), so read the identifiers straight from the database — the
  // script is a developer tool and does not need to respect that boundary.
  const tv = await prisma.tV.findFirst({
    include: { ev: { select: { serialNumber: true } } },
  })
  if (!tv) {
    console.log("  SKIP  playlist checks (no display unit registered)")
  } else {
    // Assign the campaign to the screen through the EXISTING assignments API —
    // the same call the operator makes in /admin/assignments. The previous
    // assignment is restored at the end so this is safe to run on a live box.
    const previous = await prisma.screenAssignment.findFirst({
      where: { tvId: tv.id, isActive: true },
      select: { id: true, campaignId: true },
    })
    const assignRes = await fetch(`${BASE}/api/admin/assignments`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ tvId: tv.id, campaignId, scheduleType: "CONTINUOUS" }),
    })
    check("assigned the campaign to a screen", assignRes.ok, `HTTP ${assignRes.status}`)
    restoreAssignment = previous

    const before = await playlist(cookie, tv.ev.serialNumber, tv.subSerial)
    const leaked = before.some((item) => item.id === aBody.id || item.id === bBody.id)
    check("approved-only: pending photos are absent from the TV playlist", !leaked, `${before.length} items`)

    // ------------------------------------------------------------ approval
    console.log("\nApproval")
    const approveRes = await fetch(`${BASE}/api/admin/gallery/photos/${aBody.id}/approve`, { method: "POST", headers: { cookie } })
    check("approve succeeds", approveRes.ok, `HTTP ${approveRes.status}`)

    const again = await fetch(`${BASE}/api/admin/gallery/photos/${aBody.id}/approve`, { method: "POST", headers: { cookie } })
    const againBody = (await again.json()) as { alreadyApproved?: boolean }
    check("approving twice is idempotent", again.ok && againBody.alreadyApproved === true)

    const after = await playlist(cookie, tv.ev.serialNumber, tv.subSerial)
    const nowVisible = after.some((item) => item.type === "IMAGE" && item.url.includes(`${event.id}`))
    check("approved photo is now in the TV playlist", nowVisible, `${after.length} items`)

    const imageEntry = after.find((item) => item.url.includes(`${event.id}`))
    if (imageEntry) {
      check("playlist entry carries the configured duration", imageEntry.duration === 5, `duration=${imageEntry.duration}`)

      const fetched = await fetch(`${BASE}${imageEntry.url}`)
      check("the TV can actually fetch the approved image", fetched.ok && (fetched.headers.get("content-type") ?? "").startsWith("image/"), `HTTP ${fetched.status}`)
    }

    const pendingLeak = after.some((item) => item.id === bBody.id)
    check("the still-pending photo is still absent", !pendingLeak)

    // -------------------------------------------------------------- remove
    console.log("\nRemoval")
    const removeRes = await fetch(`${BASE}/api/admin/gallery/photos/${aBody.id}/remove`, { method: "POST", headers: { cookie } })
    check("remove succeeds", removeRes.ok, `HTTP ${removeRes.status}`)

    const afterRemove = await playlist(cookie, tv.ev.serialNumber, tv.subSerial)
    check("removed photo leaves the playlist", !afterRemove.some((item) => item.url.includes(`${aBody.id}`)))

    const gone = await fetch(`${BASE}/media/uploads/gallery/${event.id}/${aBody.id}.jpg`)
    check("removed photo is deleted from storage", !gone.ok, `HTTP ${gone.status}`)
  }

  if (tv && restoreAssignment) {
    const restore = await fetch(`${BASE}/api/admin/assignments`, {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ tvId: tv.id, campaignId: restoreAssignment.campaignId, scheduleType: "CONTINUOUS" }),
    })
    check("restored the screen's original assignment", restore.ok, `HTTP ${restore.status}`)
  }

  // ------------------------------------------------------------ kill switch
  console.log("\nKill switch")
  await fetch(`${BASE}/api/admin/gallery/events/${event.id}`, {
    method: "PATCH",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ isOpen: false }),
  })
  const closed = await fetch(`${BASE}/api/contribute/${event.slug}/session`)
  const closedBody = (await closed.json()) as { open: boolean; token: string | null }
  check("paused event reports closed to the public page", closed.ok && closedBody.open === false)
  check("paused event issues no upload token", closedBody.token === null)

  const blocked = await upload(await makeImage(3))
  check("paused event refuses uploads", blocked.status === 403, `HTTP ${blocked.status}`)

  await fetch(`${BASE}/api/admin/gallery/events/${event.id}`, {
    method: "PATCH",
    headers: { cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ isOpen: true }),
  })
  const resumed = await upload(await makeImage(4))
  check("resuming restores uploads", resumed.status === 201, `HTTP ${resumed.status}`)

  // --------------------------------------------------------------- cleanup
  if (!KEEP) {
    console.log("\nCleanup")
    // Close the event and drop its rows directly. There is deliberately no
    // DELETE route: removing an event is an operator action, not a moderator
    // one, and an accidental HTTP DELETE should not be able to do it.
    await prisma.galleryPhoto.deleteMany({ where: { eventId: event.id } })
    await prisma.galleryEvent.delete({ where: { id: event.id } })
    console.log("  event and its photos removed")
  }

  await prisma.$disconnect()

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error("\nsmoke test could not run:", error instanceof Error ? error.message : error)
  process.exitCode = 1
})