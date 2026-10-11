import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/gallery/require-admin"
import { approvePhoto, rejectPhoto, removePhoto } from "@/lib/gallery/publish"
import { bulkSchema } from "@/lib/gallery/schemas"
import { sanitizeRejectReason } from "@/lib/gallery/sanitize"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Bulk actions loop the single-item services (cap 50 ids/request) so there is
 * exactly one implementation of "approve" — the concurrency guarantees in
 * publish.ts apply here for free. Results are per-item so one bad photo cannot
 * fail the batch.
 */
export async function POST(req: Request) {
  const { session, response } = await requireAdmin()
  if (response || !session) return response

  const parsed = bulkSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION", detail: parsed.error.issues }, { status: 400 })

  const { action, ids } = parsed.data
  const adminId = session.user.id

  const results = await Promise.all(
    ids.map(async (id) => {
      if (action === "approve") return { id, ...(await approvePhoto(id, adminId)) }
      if (action === "reject") return { id, ...(await rejectPhoto(id, adminId, sanitizeRejectReason(parsed.data.reason))) }
      return { id, ...(await removePhoto(id, adminId)) }
    }),
  )

  return NextResponse.json({
    action,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  })
}
