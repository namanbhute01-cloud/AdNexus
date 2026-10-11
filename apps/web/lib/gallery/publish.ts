import { prisma } from "@vaart/database"
import {
  deletePromotedGalleryPhoto,
  getPrivateStore,
  promoteGalleryPhoto,
} from "@vaart/storage"
import { notifyCampaignPlaylistChanged } from "./notify"

/**
 * Approve / reject / remove for community-gallery photos.
 *
 * Core invariant (ARCHITECTURE §1): a submission is never publishable. Only the
 * admin paths in this module create `Media` / `CampaignMedia` rows.
 *
 * Approval is idempotent and race-safe. Three independent mechanisms enforce
 * that, because INSTRUCTIONS T8 demands "10 parallel approvals of one photo →
 * exactly one Media and one CampaignMedia":
 *
 *   1. compare-and-swap claim  — `updateMany … where status IN (PENDING, REJECTED, REMOVED)`
 *      means only ONE caller can move the row out of those states.
 *   2. deterministic storage key — promotion writes `…/<photoId>.jpg` every time.
 *   3. `Media.r2Key` is `@unique`, so the DB is the final arbiter.
 *
 * `CampaignMedia` is unique on `(campaignId, mediaId)` and NOT on
 * `(campaignId, order)` (T0 §1), so `order` assignment is serialised with a
 * Postgres advisory lock rather than relying on uniqueness.
 */

export type ApproveOutcome = {
  ok: boolean
  /** True when the photo was already APPROVED before this call. */
  alreadyApproved?: boolean
  mediaId?: string
  campaignMediaId?: string
  error?: "NOT_FOUND" | "CAMPAIGN_MISSING" | "CONFLICT" | "FAILED"
}

export type RejectOutcome = { ok: boolean; error?: "NOT_FOUND" | "CONFLICT" | "FAILED" }
export type RemoveOutcome = { ok: boolean; error?: "NOT_FOUND" | "FAILED" }

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: string }).code === "P2002"
  )
}

export async function approvePhoto(photoId: string, adminId: string): Promise<ApproveOutcome> {
  // Load photo + event. `campaignId` is validated to still exist inside the tx.
  const photo = await prisma.galleryPhoto.findUnique({
    where: { id: photoId },
    include: { event: { select: { campaignId: true, displaySeconds: true } } },
  })
  if (!photo) return { ok: false, error: "NOT_FOUND" }

  // Already published — idempotent success, no second Media.
  if (photo.status === "APPROVED") {
    return { ok: true, alreadyApproved: true, mediaId: photo.mediaId ?? undefined, campaignMediaId: photo.campaignMediaId ?? undefined }
  }

  // 1. Compare-and-swap claim. Exactly one concurrent caller wins.
  const claimed = await prisma.galleryPhoto.updateMany({
    where: { id: photoId, status: { in: ["PENDING", "REJECTED", "REMOVED"] } },
    data: { status: "APPROVED", reviewedById: adminId, reviewedAt: new Date(), rejectReason: null },
  })
  if (claimed.count === 0) {
    // Someone else claimed it between our read and our write.
    const fresh = await prisma.galleryPhoto.findUnique({ where: { id: photoId }, select: { status: true } })
    if (fresh?.status === "APPROVED") return { ok: true, alreadyApproved: true }
    return { ok: false, error: "CONFLICT" }
  }

  const store = getPrivateStore()
  let promoted: Awaited<ReturnType<typeof promoteGalleryPhoto>> | null = null

  try {
    // 2. Promote the quarantined file into the public media location. The
    //    SOURCE is the key recorded on the row; the DESTINATION is derived from
    //    the photo id, so re-approval reproduces the same public asset.
    promoted = await promoteGalleryPhoto(store, photo.eventId, photo.id, photo.storageKey)

    // 3. Serialised transaction: advisory lock on the campaign, then order +
    //    Media + CampaignMedia + photo back-reference.
    const result = await prisma.$transaction(async (tx) => {
      // hashtext() gives a stable 32-bit key from the campaign id; the
      // transaction-scoped advisory lock serialises concurrent order assignment
      // without blocking anything else.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${photo.event.campaignId}))`

      const campaign = await tx.campaign.findUnique({
        where: { id: photo.event.campaignId },
        select: { id: true },
      })
      if (!campaign) return null

      const maxOrder = await tx.campaignMedia.aggregate({
        where: { campaignId: photo.event.campaignId },
        _max: { order: true },
      })

      const media = await tx.media.create({
        data: {
          userId: adminId,
          filename: `${photo.id}.jpg`,
          originalName: photo.contributorName ? `${photo.contributorName}.jpg` : `${photo.id}.jpg`,
          r2Key: promoted!.r2Key,
          url: promoted!.url,
          type: "IMAGE",
          sizeBytes: photo.sizeBytes, // Int, never BigInt
          status: "READY",
        },
        select: { id: true },
      })

      const campaignMedia = await tx.campaignMedia.create({
        data: {
          campaignId: photo.event.campaignId,
          mediaId: media.id,
          order: (maxOrder._max.order ?? -1) + 1,
          displayTime: photo.event.displaySeconds,
        },
        select: { id: true },
      })

      await tx.galleryPhoto.update({
        where: { id: photo.id },
        data: { mediaId: media.id, campaignMediaId: campaignMedia.id },
      })

      return { mediaId: media.id, campaignMediaId: campaignMedia.id }
    })

    if (!result) {
      await rollback(photoId, photo.status, promoted)
      return { ok: false, error: "CAMPAIGN_MISSING" }
    }

    // 4. Post-commit: notify the screens.
    //
    //    The quarantined full-size is deliberately KEPT. ARCHITECTURE §8.2 said
    //    to delete it here, but that contradicts §8.1's required
    //    `REMOVED ──approve──► APPROVED` transition: once deleted, the pending
    //    copy is the ONLY copy, and re-approval has nothing to promote. The
    //    state machine wins (see DECISIONS D12). Cost is bounded — ~1 MB per
    //    approved photo — and the RUNBOOK teardown step sweeps the directory.
    await notifyCampaignPlaylistChanged(photo.event.campaignId)

    return { ok: true, mediaId: result.mediaId, campaignMediaId: result.campaignMediaId }
  } catch (error) {
    if (isUniqueViolation(error)) {
      // The `Media.r2Key @unique` backstop fired: a concurrent approval already
      // created the row. Treat as the idempotent success it is.
      const fresh = await prisma.galleryPhoto.findUnique({ where: { id: photoId } })
      if (fresh?.status === "APPROVED" && fresh.mediaId) {
        return { ok: true, alreadyApproved: true, mediaId: fresh.mediaId, campaignMediaId: fresh.campaignMediaId ?? undefined }
      }
    }
    await rollback(photoId, photo.status, promoted)
    console.error("[gallery] approve failed:", error)
    return { ok: false, error: "FAILED" }
  }
}

async function rollback(
  photoId: string,
  previousStatus: "PENDING" | "REJECTED" | "REMOVED",
  promoted: Awaited<ReturnType<typeof promoteGalleryPhoto>> | null,
) {
  await prisma.galleryPhoto
    .update({
      where: { id: photoId },
      data: {
        status: previousStatus,
        reviewedAt: null,
        mediaId: null,
        campaignMediaId: null,
      },
    })
    .catch(() => undefined)

  if (promoted) await deletePromotedGalleryPhoto(promoted)
}

export async function rejectPhoto(photoId: string, adminId: string, reason: string | null): Promise<RejectOutcome> {
  const photo = await prisma.galleryPhoto.findUnique({ where: { id: photoId }, select: { id: true } })
  if (!photo) return { ok: false, error: "NOT_FOUND" }

  // Rejecting never touches Media/CampaignMedia. If it was somehow approved,
  // block it — the admin must "remove" instead, which actually unpublishes.
  const updated = await prisma.galleryPhoto.updateMany({
    where: { id: photoId, status: { in: ["PENDING", "REJECTED"] } },
    data: { status: "REJECTED", reviewedById: adminId, reviewedAt: new Date(), rejectReason: reason },
  })
  if (updated.count === 0) return { ok: false, error: "CONFLICT" }
  return { ok: true }
}

export async function removePhoto(photoId: string, adminId: string): Promise<RemoveOutcome> {
  const photo = await prisma.galleryPhoto.findUnique({
    where: { id: photoId },
    include: { event: { select: { campaignId: true } } },
  })
  if (!photo) return { ok: false, error: "NOT_FOUND" }
  if (photo.status !== "APPROVED") return { ok: false, error: "NOT_FOUND" }

  // Capture the promoted asset BEFORE the transaction deletes the Media row.
  // Reading it afterwards returns null and silently orphans the file on disk.
  const promotedFile = photo.mediaId
    ? await prisma.media.findUnique({
        where: { id: photo.mediaId },
        select: { r2Key: true, url: true },
      })
    : null

  try {
    await prisma.$transaction(async (tx) => {
      // Detach from the campaign playlist first.
      if (photo.campaignMediaId) {
        await tx.campaignMedia.deleteMany({ where: { id: photo.campaignMediaId } })
      }

      // Delete the Media row + promoted file only if no other campaign still
      // references it (defensive: today a gallery photo has exactly one).
      if (photo.mediaId) {
        const otherRefs = await tx.campaignMedia.count({ where: { mediaId: photo.mediaId } })
        if (otherRefs === 0) {
          await tx.media.deleteMany({ where: { id: photo.mediaId } })
        }
      }

      await tx.galleryPhoto.update({
        where: { id: photoId },
        data: {
          status: "REMOVED",
          reviewedById: adminId,
          reviewedAt: new Date(),
          mediaId: null,
          campaignMediaId: null,
        },
      })
    })

    // Promoted file cleanup is best-effort and outside the transaction.
    if (promotedFile?.r2Key) {
      const localPath = promotedFile.url.startsWith("/media/")
        ? `${process.cwd()}/public${promotedFile.url.slice("/media".length)}`
        : null
      await deletePromotedGalleryPhoto({
        r2Key: promotedFile.r2Key,
        url: promotedFile.url,
        localPath,
      })
    }

    await notifyCampaignPlaylistChanged(photo.event.campaignId)
    return { ok: true }
  } catch (error) {
    console.error("[gallery] remove failed:", error)
    return { ok: false, error: "FAILED" }
  }
}