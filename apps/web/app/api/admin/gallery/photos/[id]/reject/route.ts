import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/gallery/require-admin"
import { rejectPhoto } from "@/lib/gallery/publish"
import { rejectSchema } from "@/lib/gallery/schemas"
import { sanitizeRejectReason } from "@/lib/gallery/sanitize"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

export async function POST(req: Request, context: Context) {
  const { session, response } = await requireAdmin()
  if (response || !session) return response

  const { id } = await context.params
  const parsed = rejectSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 })

  const result = await rejectPhoto(id, session.user.id, sanitizeRejectReason(parsed.data.reason))

  if (result.ok) return NextResponse.json({ ok: true })
  const status = result.error === "NOT_FOUND" ? 404 : result.error === "CONFLICT" ? 409 : 500
  return NextResponse.json({ error: result.error ?? "FAILED" }, { status })
}
