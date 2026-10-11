import { prisma } from "@vaart/database"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/gallery/require-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

/** Polled by the admin UI every 5s to drive the pending badge and the title. */
export async function GET(_req: Request, context: Context) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await context.params

  const grouped = await prisma.galleryPhoto.groupBy({
    by: ["status"],
    where: { eventId: id },
    _count: { _all: true },
  })

  const counts: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, REMOVED: 0 }
  for (const row of grouped) counts[row.status] = row._count._all

  const event = await prisma.galleryEvent.findUnique({
    where: { id },
    select: { isOpen: true, maxPending: true },
  })

  return NextResponse.json(
    {
      pending: counts.PENDING,
      approved: counts.APPROVED,
      rejected: counts.REJECTED,
      removed: counts.REMOVED,
      isOpen: event?.isOpen ?? true,
      intakeFull: counts.PENDING >= (event?.maxPending ?? Number.MAX_SAFE_INTEGER),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}