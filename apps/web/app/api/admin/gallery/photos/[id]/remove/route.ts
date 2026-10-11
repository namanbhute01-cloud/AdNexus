import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/gallery/require-admin"
import { removePhoto } from "@/lib/gallery/publish"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

export async function POST(_req: Request, context: Context) {
  const { session, response } = await requireAdmin()
  if (response || !session) return response

  const { id } = await context.params
  const result = await removePhoto(id, session.user.id)

  if (result.ok) return NextResponse.json({ ok: true })
  return NextResponse.json({ error: result.error ?? "FAILED" }, { status: result.error === "NOT_FOUND" ? 404 : 500 })
}
