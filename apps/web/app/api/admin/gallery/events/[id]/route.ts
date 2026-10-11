import { prisma } from "@vaart/database"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/gallery/require-admin"
import { eventPatchSchema } from "@/lib/gallery/schemas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, context: Context) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await context.params
  const parsed = eventPatchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION", detail: parsed.error.issues }, { status: 400 })
  }

  if (parsed.data.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: parsed.data.campaignId }, select: { id: true } })
    if (!campaign) return NextResponse.json({ error: "CAMPAIGN_NOT_FOUND" }, { status: 400 })
  }

  const exists = await prisma.galleryEvent.findUnique({ where: { id }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

  const event = await prisma.galleryEvent.update({ where: { id }, data: parsed.data })
  return NextResponse.json(event)
}