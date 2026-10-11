import { prisma } from "@vaart/database"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/gallery/require-admin"
import { eventCreateSchema } from "@/lib/gallery/schemas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const { response } = await requireAdmin()
  if (response) return response

  const events = await prisma.galleryEvent.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      campaignId: true,
      isOpen: true,
      maxFilesPerRequest: true,
      maxFileBytes: true,
      maxPending: true,
      perTokenCap: true,
      displaySeconds: true,
      createdAt: true,
      _count: { select: { photos: true } },
    },
  })

  return NextResponse.json(
    events.map(({ _count, ...event }) => ({
      ...event,
      totalPhotos: _count.photos,
    })),
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST(req: Request) {
  const { response } = await requireAdmin()
  if (response) return response

  const parsed = eventCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", detail: parsed.error.issues }, { status: 400 })
  }

  // DECISIONS D9: campaignId is mandatory, and it must really exist — approval
  // is a single transaction with no partial state.
  const campaign = await prisma.campaign.findUnique({ where: { id: parsed.data.campaignId }, select: { id: true } })
  if (!campaign) return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 400 })

  const existing = await prisma.galleryEvent.findUnique({ where: { slug: parsed.data.slug }, select: { id: true } })
  if (existing) return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 })

  const event = await prisma.galleryEvent.create({ data: parsed.data })
  return NextResponse.json(event, { status: 201 })
}