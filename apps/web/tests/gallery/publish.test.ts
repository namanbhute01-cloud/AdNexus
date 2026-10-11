import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"
import { after, before, describe, it } from "node:test"
import { prisma } from "@vaart/database"
import { getPrivateStore, resetPrivateStore } from "@vaart/storage"
import { approvePhoto, rejectPhoto, removePhoto } from "@/lib/gallery/publish"
import { getPlaylistForCampaign } from "@/lib/campaign-playlist"

const TEST_PRIVATE_DIR = path.join(process.cwd(), ".data", "gallery-test")
process.env.GALLERY_PRIVATE_DIR = TEST_PRIVATE_DIR
process.env.DATABASE_URL = process.env.DATABASE_URL ?? ""
resetPrivateStore()

const SLUG = "test-concurrency"
let eventId = ""
let adminId = ""
const createdPhotoIds: string[] = []
const cleanupCampaignIds: string[] = []

async function makeJpeg(seed: number): Promise<Buffer> {
  const px = Buffer.alloc(320 * 240 * 3)
  let s = seed >>> 0
  for (let i = 0; i < px.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0
    px[i] = (s >>> 24) & 0xff
  }
  return sharp(px, { raw: { width: 320, height: 240, channels: 3 } }).jpeg().toBuffer()
}

async function seedPhoto(seed: number) {
  const store = getPrivateStore()
  const buffer = await makeJpeg(seed)
  const photo = await prisma.galleryPhoto.create({
    data: {
      eventId,
      status: "PENDING",
      // The upload route stores under a random UUID; promotion reads THIS key,
      // so the fixture must exercise the real shape rather than a convenient one.
      storageKey: `${eventId}/${seed}-${Math.random().toString(36).slice(2, 10)}.jpg`,
      thumbKey: `${eventId}/${seed}-${Math.random().toString(36).slice(2, 10)}.thumb.jpg`,
      width: 320,
      height: 240,
      sizeBytes: buffer.length,
      sha256: `seed-${seed}-${Date.now()}`,
      consentAt: new Date(),
      ipHash: "testhash00000000",
    },
  })

  await store.put(photo.storageKey, buffer, "image/jpeg")
  await store.put(photo.thumbKey, buffer, "image/jpeg")
  createdPhotoIds.push(photo.id)
  return photo
}

before(async () => {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } })
  assert.ok(admin, "seed an ADMIN user first (pnpm --filter @vaart/database exec prisma db seed)")
  adminId = admin.id

  const campaign = await prisma.campaign.create({
    data: { userId: adminId, name: `gallery-concurrency-${Date.now()}`, status: "ACTIVE" },
  })
  cleanupCampaignIds.push(campaign.id)

  const event = await prisma.galleryEvent.create({
    data: { slug: `${SLUG}-${Date.now()}`, name: "Concurrency Test", campaignId: campaign.id, displaySeconds: 6 },
  })
  eventId = event.id

  await mkdir(TEST_PRIVATE_DIR, { recursive: true })
})

after(async () => {
  for (const id of createdPhotoIds) {
    await prisma.galleryPhoto.delete({ where: { id } }).catch(() => undefined)
  }
  await prisma.galleryEvent.deleteMany({ where: { id: eventId } }).catch(() => undefined)
  for (const id of cleanupCampaignIds) {
    await prisma.campaignMedia.deleteMany({ where: { campaignId: id } }).catch(() => undefined)
    await prisma.media.deleteMany({ where: { r2Key: { contains: `/${id}/` } } }).catch(() => undefined)
    await prisma.campaign.delete({ where: { id } }).catch(() => undefined)
  }
  await rm(path.join(process.cwd(), "public", "uploads", "gallery", eventId), { recursive: true, force: true }).catch(() => undefined)
  await prisma.$disconnect()
  resetPrivateStore()
})

describe("approve is idempotent under concurrency", () => {
  it("10 parallel approvals of ONE photo produce exactly one Media and one CampaignMedia", async () => {
    const photo = await seedPhoto(101)

    const results = await Promise.all(
      Array.from({ length: 10 }, () => approvePhoto(photo.id, adminId)),
    )

    const ok = results.filter((r) => r.ok)
    assert.equal(ok.length, 10, "every caller should get a success (the losers are idempotent)")

    const final = await prisma.galleryPhoto.findUniqueOrThrow({
      where: { id: photo.id },
      select: { status: true, mediaId: true, campaignMediaId: true },
    })
    assert.equal(final.status, "APPROVED")
    assert.ok(final.mediaId)
    assert.ok(final.campaignMediaId)

    const mediaCount = await prisma.media.count({ where: { r2Key: { contains: `/${photo.id}.jpg` } } })
    assert.equal(mediaCount, 1, "exactly one Media row must exist")

    const cmCount = await prisma.campaignMedia.count({ where: { campaignId: (await campaignIdFor(eventId)) } })
    const linked = await prisma.campaignMedia.count({ where: { mediaId: final.mediaId } })
    assert.equal(linked, 1, "exactly one CampaignMedia for the Media row")
    assert.equal(cmCount >= 1, true)
  })

  it("5 parallel approvals of DIFFERENT photos get distinct sequential order values", async () => {
    const photos = await Promise.all([1, 2, 3, 4, 5].map((n) => seedPhoto(200 + n)))
    const campaignId = await campaignIdFor(eventId)

    const before = await prisma.campaignMedia.aggregate({
      where: { campaignId },
      _max: { order: true },
    })
    const startOrder = (before._max.order ?? -1) + 1

    await Promise.all(photos.map((p) => approvePhoto(p.id, adminId)))

    const rows = await prisma.campaignMedia.findMany({
      where: { campaignId, mediaId: { in: photos.map(() => "") } },
    })
    // Fetch by photo -> mediaId instead of guessing.
    const mediaIds = await prisma.galleryPhoto.findMany({
      where: { id: { in: photos.map((p) => p.id) } },
      select: { mediaId: true },
    })
    const ids = mediaIds.map((m) => m.mediaId).filter((id): id is string => Boolean(id))
    assert.equal(ids.length, 5, "all five should be approved")

    const ordered = await prisma.campaignMedia.findMany({
      where: { mediaId: { in: ids } },
      select: { mediaId: true, order: true },
    })
    const orders = ordered.map((o) => o.order).sort((a, b) => a - b)

    assert.equal(new Set(orders).size, 5, `orders must be unique, got ${orders.join(",")}`)
    assert.deepEqual(orders, [startOrder, startOrder + 1, startOrder + 2, startOrder + 3, startOrder + 4])

    assert.equal(rows.length >= 0, true)
  })
})

describe("state machine", () => {
  it("reject never creates Media or CampaignMedia", async () => {
    const photo = await seedPhoto(301)
    const result = await rejectPhoto(photo.id, adminId, "not appropriate")

    assert.equal(result.ok, true)
    const final = await prisma.galleryPhoto.findUniqueOrThrow({
      where: { id: photo.id },
      select: { status: true, mediaId: true, rejectReason: true },
    })
    assert.equal(final.status, "REJECTED")
    assert.equal(final.mediaId, null)
    assert.equal(final.rejectReason, "not appropriate")

    const media = await prisma.media.count({ where: { r2Key: { contains: `/${photo.id}.jpg` } } })
    assert.equal(media, 0)
  })

  it("remove unpublishes an approved photo and drops it from the playlist", async () => {
    const photo = await seedPhoto(401)
    const campaignId = await campaignIdFor(eventId)

    assert.equal((await approvePhoto(photo.id, adminId)).ok, true)
    const approved = await prisma.galleryPhoto.findUniqueOrThrow({ where: { id: photo.id }, select: { mediaId: true } })

    const before = await getPlaylistForCampaign(campaignId)
    assert.equal(before.some((item) => item.id === approved.mediaId || item.url.includes(`${photo.id}.jpg`)), true)

    const result = await removePhoto(photo.id, adminId)
    assert.equal(result.ok, true)

    const after = await getPlaylistForCampaign(campaignId)
    assert.equal(after.some((item) => item.url.includes(`${photo.id}.jpg`)), false, "removed photo must leave the playlist")

    const final = await prisma.galleryPhoto.findUniqueOrThrow({
      where: { id: photo.id },
      select: { status: true, mediaId: true, campaignMediaId: true },
    })
    assert.equal(final.status, "REMOVED")
    assert.equal(final.mediaId, null)

    const mediaLeft = await prisma.media.count({ where: { r2Key: { contains: `/${photo.id}.jpg` } } })
    assert.equal(mediaLeft, 0, "the orphaned Media row should be cleaned up")

    // Regression: the file used to be orphaned on disk because the code read the
    // Media row *after* the transaction had deleted it.
    const promotedPath = path.join(process.cwd(), "public", "uploads", "gallery", eventId, `${photo.id}.jpg`)
    assert.equal(existsSync(promotedPath), false, "the promoted file must be deleted from public/")
  })

  it("remove then re-approve works", async () => {
    const photo = await seedPhoto(501)
    const campaignId = await campaignIdFor(eventId)

    await approvePhoto(photo.id, adminId)
    await removePhoto(photo.id, adminId)
    const again = await approvePhoto(photo.id, adminId)

    assert.equal(again.ok, true)
    assert.equal(again.alreadyApproved, undefined)

    const playlist = await getPlaylistForCampaign(campaignId)
    assert.equal(playlist.some((item) => item.url.includes(`${photo.id}.jpg`)), true)

    // Local-driver URLs must route through /media/ so they work without a
    // restart. Next.js snapshots public/ at server start (AUDIT F11).
    const entry = playlist.find((item) => item.url.includes(`${photo.id}.jpg`))
    assert.ok(entry)
    assert.ok(
      entry.url.startsWith("/media/uploads/gallery/"),
      `expected /media/uploads/gallery/ prefix, got ${entry.url}`,
    )

    const media = await prisma.media.count({ where: { r2Key: { contains: `/${photo.id}.jpg` } } })
    assert.equal(media, 1, "re-approval must not leave a second Media row")
  })

  it("a rejected photo can later be approved", async () => {
    const photo = await seedPhoto(601)
    await rejectPhoto(photo.id, adminId, "unsure")
    const result = await approvePhoto(photo.id, adminId)
    assert.equal(result.ok, true)

    const final = await prisma.galleryPhoto.findUniqueOrThrow({ where: { id: photo.id }, select: { status: true } })
    assert.equal(final.status, "APPROVED")
  })

  it("approving an already-approved photo is a no-op that still reports success", async () => {
    const photo = await seedPhoto(701)
    await approvePhoto(photo.id, adminId)
    const again = await approvePhoto(photo.id, adminId)

    assert.equal(again.ok, true)
    assert.equal(again.alreadyApproved, true)
    const media = await prisma.media.count({ where: { r2Key: { contains: `/${photo.id}.jpg` } } })
    assert.equal(media, 1)
  })

  it("rejecting an approved photo is refused (use remove instead)", async () => {
    const photo = await seedPhoto(801)
    await approvePhoto(photo.id, adminId)
    const result = await rejectPhoto(photo.id, adminId, "oops")
    assert.equal(result.ok, false)
    assert.equal(result.error, "CONFLICT")
  })

  it("unknown photo ids fail cleanly", async () => {
    assert.deepEqual(await approvePhoto("does-not-exist", adminId), { ok: false, error: "NOT_FOUND" })
    assert.deepEqual(await rejectPhoto("does-not-exist", adminId, null), { ok: false, error: "NOT_FOUND" })
    assert.deepEqual(await removePhoto("does-not-exist", adminId), { ok: false, error: "NOT_FOUND" })
  })
})

async function campaignIdFor(id: string): Promise<string> {
  const event = await prisma.galleryEvent.findUniqueOrThrow({ where: { id }, select: { campaignId: true } })
  return event.campaignId
}