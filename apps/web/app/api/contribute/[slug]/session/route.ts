import { prisma } from "@vaart/database"
import { NextResponse } from "next/server"
import { GalleryConfigError } from "@/lib/gallery/env"
import { publicLimits } from "@/lib/gallery/limits"
import { publicError } from "@/lib/gallery/public-errors"
import { signToken } from "@/lib/gallery/upload-token"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ slug: string }> }

/**
 * Bootstrap for the public upload page.
 *
 * Returns the event's display name, its limits, whether intake is open, and a
 * short-lived upload token. A closed event still gets a 200 with `open: false`
 * so the page can render a friendly "submissions are closed" state rather than
 * a dead end.
 */
export async function GET(_req: Request, context: Context) {
  let slug: string
  try {
    slug = (await context.params).slug
  } catch {
    return publicError("BAD_REQUEST")
  }

  try {
    const event = await prisma.galleryEvent.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, isOpen: true, maxFilesPerRequest: true, maxFileBytes: true, maxPending: true },
    })

    if (!event) return publicError("NOT_FOUND")

    const body = {
      open: event.isOpen,
      name: event.name,
      limits: publicLimits(event),
      token: event.isOpen ? signToken(event.slug) : null,
    }

    return NextResponse.json(body, {
      headers: {
        // Event state and tokens must never be cached by a phone's HTTP cache
        // or by a Cloudflare edge sitting in front of a laptop.
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    })
  } catch (error) {
    if (error instanceof GalleryConfigError) {
      // Misconfiguration is an operator problem, not a student problem.
      console.error("[gallery] configuration error:", error.message)
      return publicError("SERVER_ERROR")
    }
    console.error("[gallery] session lookup failed:", error)
    return publicError("SERVER_ERROR")
  }
}