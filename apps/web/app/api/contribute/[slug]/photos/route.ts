import { randomUUID } from "node:crypto"
import { prisma } from "@vaart/database"
import { getPrivateStore } from "@vaart/storage"
import { NextResponse } from "next/server"
import { getClientIp, hashIp } from "@/lib/gallery/client-ip"
import { GalleryConfigError, requireGalleryEnv } from "@/lib/gallery/env"
import {
  GALLERY_TOKEN_HEADER,
  HONEYPOT_FIELD,
  LIMITS,
  MULTIPART_OVERHEAD_BYTES,
  perTokenRule,
} from "@/lib/gallery/limits"
import { PipelineError, processUpload } from "@/lib/gallery/image-pipeline"
import { publicError, type PublicErrorCode } from "@/lib/gallery/public-errors"
import { checkRateLimit } from "@/lib/gallery/rate-limit"
import { sanitizeCaption, sanitizeName } from "@/lib/gallery/sanitize"
import { verifyToken } from "@/lib/gallery/upload-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ slug: string }> }

/** Pipeline error codes that map 1:1 onto public error codes. */
const PIPELINE_TO_PUBLIC: Partial<Record<PipelineError["code"], PublicErrorCode>> = {
  BAD_TYPE: "BAD_TYPE",
  BAD_IMAGE: "BAD_IMAGE",
  TOO_LARGE_PIXELS: "TOO_LARGE_PIXELS",
  TIMEOUT: "TIMEOUT",
  BUSY: "BUSY",
}

export async function POST(req: Request, context: Context) {
  let slug: string
  try {
    slug = (await context.params).slug
  } catch {
    return publicError("BAD_REQUEST")
  }

  let ipSalt: string
  try {
    ipSalt = requireGalleryEnv().ipSalt
  } catch (error) {
    if (error instanceof GalleryConfigError) {
      console.error("[gallery] configuration error:", error.message)
      return publicError("SERVER_ERROR")
    }
    throw error
  }

  // 1. Event lookup.
  const event = await prisma.galleryEvent.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      isOpen: true,
      maxFileBytes: true,
      maxPending: true,
      perTokenCap: true,
    },
  })
  if (!event) return publicError("NOT_FOUND")
  if (!event.isOpen) return publicError("EVENT_CLOSED")

  // 2. Upload token. This is anti-abuse, not authentication (ARCHITECTURE §11).
  const token = req.headers.get(GALLERY_TOKEN_HEADER)
  const tokenResult = verifyToken(token, slug)
  if (!tokenResult.ok) return publicError("BAD_TOKEN")
  const { jti } = tokenResult.payload

  // 3. Rate limits: per IP-hash, per token, global.
  const ipHash = hashIp(getClientIp(req), ipSalt)

  const ipLimit = checkRateLimit(`gallery:ip:${ipHash}`, LIMITS.perIp)
  if (!ipLimit.allowed) return publicError("RATE_LIMITED", ipLimit.retryAfter)

  const tokenLimit = checkRateLimit(`gallery:token:${jti}`, perTokenRule(event))
  if (!tokenLimit.allowed) return publicError("RATE_LIMITED", tokenLimit.retryAfter)

  const globalLimit = checkRateLimit("gallery:global", LIMITS.global)
  if (!globalLimit.allowed) return publicError("RATE_LIMITED", globalLimit.retryAfter)

  // 4. Pending cap — cheap count first so a full queue never costs a sharp run.
  const pendingCount = await prisma.galleryPhoto.count({
    where: { eventId: event.id, status: "PENDING" },
  })
  if (pendingCount >= event.maxPending) return publicError("INTAKE_FULL")

  // 5. Reject oversized bodies BEFORE reading them off the socket.
  const contentLength = Number(req.headers.get("content-length") ?? "0")
  if (contentLength > event.maxFileBytes + MULTIPART_OVERHEAD_BYTES) {
    return publicError("TOO_LARGE")
  }

  // 6. Parse multipart and validate the non-file fields.
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return publicError("BAD_REQUEST")
  }

  // Honeypot: silently accept and discard, so a bot learns nothing.
  if (typeof form.get(HONEYPOT_FIELD) === "string" && (form.get(HONEYPOT_FIELD) as string).trim() !== "") {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  if (form.get("consent") !== "true") return publicError("BAD_REQUEST")

  const contributorName = sanitizeName(form.get("name"))
  const caption = sanitizeCaption(form.get("caption"))

  const file = form.get("file")
  if (!(file instanceof File)) return publicError("BAD_REQUEST")
  if (file.size === 0) return publicError("BAD_REQUEST")
  if (file.size > event.maxFileBytes) return publicError("TOO_LARGE")

  // 7-9. Sniff + decode + re-encode. `processUpload` enforces the magic-byte
  // check, the 50 MP pixel ceiling, EXIF rotation, and the concurrency gate.
  let processed: Awaited<ReturnType<typeof processUpload>>
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    processed = await processUpload(buffer)
  } catch (error) {
    if (error instanceof PipelineError) {
      const code = PIPELINE_TO_PUBLIC[error.code] ?? "BAD_IMAGE"
      return publicError(code)
    }
    console.error("[gallery] unexpected pipeline failure:", error)
    return publicError("SERVER_ERROR")
  }

  // 10. De-duplicate on the re-encoded bytes (DECISIONS D10).
  const existing = await prisma.galleryPhoto.findUnique({
    where: { eventId_sha256: { eventId: event.id, sha256: processed.sha256 } },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ id: existing.id, duplicate: true }, { headers: { "Cache-Control": "no-store" } })
  }

  // 11. Quarantine storage — never under public/, never at a public R2 prefix.
  const store = getPrivateStore()
  const keyId = randomUUID()
  const storageKey = `${event.id}/${keyId}.jpg`
  const thumbKey = `${event.id}/${keyId}.thumb.jpg`

  try {
    await store.put(storageKey, processed.full, "image/jpeg")
    await store.put(thumbKey, processed.thumb, "image/jpeg")
  } catch (error) {
    console.error("[gallery] private store write failed:", error)
    // Clean up the half-written pair so quarantine does not accumulate orphans.
    await Promise.allSettled([store.delete(storageKey), store.delete(thumbKey)])
    return publicError("SERVER_ERROR")
  }

  // 12. Persist as PENDING. Nothing here is publishable.
  try {
    const photo = await prisma.galleryPhoto.create({
      data: {
        eventId: event.id,
        status: "PENDING",
        storageKey,
        thumbKey,
        width: processed.width,
        height: processed.height,
        sizeBytes: processed.sizeBytes,
        sha256: processed.sha256,
        contributorName,
        caption,
        consentAt: new Date(),
        ipHash,
      },
      select: { id: true },
    })

    return NextResponse.json(
      { id: photo.id, duplicate: false },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    // P2002 = lost a race against an identical upload; treat as a duplicate.
    if (isUniqueViolation(error)) {
      await Promise.allSettled([store.delete(storageKey), store.delete(thumbKey)])
      const winner = await prisma.galleryPhoto.findUnique({
        where: { eventId_sha256: { eventId: event.id, sha256: processed.sha256 } },
        select: { id: true },
      })
      if (winner) {
        return NextResponse.json({ id: winner.id, duplicate: true }, { headers: { "Cache-Control": "no-store" } })
      }
    }

    console.error("[gallery] photo insert failed:", error)
    await Promise.allSettled([store.delete(storageKey), store.delete(thumbKey)])
    return publicError("SERVER_ERROR")
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  )
}