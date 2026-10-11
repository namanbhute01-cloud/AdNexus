import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Liveness probe.
 *
 * Deliberately returns ONLY `{ ok: true }` — no DB round-trip, no version, no
 * environment detail. Anything more is reconnaissance for whoever finds the
 * endpoint once the app is internet-facing (INSTRUCTIONS T10).
 */
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
}