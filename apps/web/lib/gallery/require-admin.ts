import { auth } from "@/auth"
import { NextResponse } from "next/server"

/**
 * The single access gate for every `/api/admin/gallery/**` handler.
 *
 * `proxy.ts` only performs a coarse "is there a session" check, and hidden UI
 * is not access control — so each route calls this itself, first, before
 * touching any input (INSTRUCTIONS hard rule 5).
 *
 * Returns the session on success, or a ready-to-return Response on failure.
 */
export async function requireAdmin() {
  const session = await auth()

  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    }
  }

  if (session.user.role !== "ADMIN") {
    return {
      session: null,
      response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
    }
  }

  return { session, response: null }
}

export type AdminSession = NonNullable<Awaited<ReturnType<typeof requireAdmin>>["session"]>