import { prisma } from "@vaart/database"
import { NextResponse, type NextRequest } from "next/server"
import { requireAdmin } from "@/lib/gallery/require-admin"
import { photoListSchema } from "@/lib/gallery/schemas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

/**
 * Cursor-paginated photo list, newest first.
 *
 * The cursor is the `createdAt` of the last row; we also tie-break on `id`
 * because two uploads can share a timestamp to the millisecond and an unstable
 * sort would silently skip rows.
 */
export async function GET(req: NextRequest, context: Context) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await context.params

  const parsed = photoListSchema.safeParse({
    status: req.nextUrl.searchParams.get("status") ?? undefined,
    cursor: req.nextUrl.searchParams.get("cursor") ?? undefined,
    limit: req.nextUrl.searchParams.get("limit") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", detail: parsed.error.issues }, { status: 400 })
  }

  const { status, limit } = parsed.data

  // Cursor is `<createdAtISO>|<id>`. Both halves are needed: two uploads can
  // share a millisecond, and ordering by `createdAt` alone would make the page
  // boundary unstable and silently skip rows.
  let cursor: { createdAt: Date; id: string } | null = null
  if (parsed.data.cursor) {
    const raw = parsed.data.cursor
    const sep = raw.lastIndexOf("|")
    const iso = sep === -1 ? raw : raw.slice(0, sep)
    const rowId = sep === -1 ? "" : raw.slice(sep + 1)
    const date = new Date(iso)
    if (!Number.isNaN(date.getTime()) && rowId) cursor = { createdAt: date, id: rowId }
  }

  const photos = await prisma.galleryPhoto.findMany({
    where: {
      eventId: id,
      status,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1, // one extra to detect whether another page exists
    select: {
      id: true,
      eventId: true,
      status: true,
      width: true,
      height: true,
      sizeBytes: true,
      contributorName: true,
      caption: true,
      createdAt: true,
      reviewedAt: true,
      rejectReason: true,
    },
  })

  const hasMore = photos.length > limit
  const page = hasMore ? photos.slice(0, limit) : photos
  const last = page[page.length - 1]

  return NextResponse.json(
    {
      photos: page,
      nextCursor: hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}