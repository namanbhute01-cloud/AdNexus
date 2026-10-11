import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { getR2PublicBase } from "@vaart/storage"

/**
 * Public read-only media endpoint — the local-disk equivalent of R2's public
 * bucket.
 *
 * WHY THIS EXISTS (AUDIT finding F11): Next.js snapshots the `public/` directory
 * when the server starts. A file written into `public/uploads/` *while the
 * server is running* returns 404 until the next restart. On event day that
 * means an admin approves a photo, the DB updates, the playlist is correct —
 * and the TV shows a broken image because the file was not in the startup
 * snapshot. Approved media is therefore served through this route instead,
 * which reads from disk per request and is immune to the snapshot.
 *
 * SAFETY: it serves ONLY the approved-media prefix. Pending submissions live in
 * `.data/gallery`, which is a different root entirely and is never reachable
 * here. Filenames are opaque ids, and the data is already public by definition
 * once approved — this is exactly the exposure an R2 public bucket provides.
 */

export const runtime = "nodejs"

const ALLOWED_PREFIX = "uploads"
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
}

type Context = { params: Promise<{ path: string[] }> }

export async function GET(_req: Request, context: Context) {
  // With R2 configured, media is served straight from the bucket's public URL
  // and this route is never used.
  if (getR2PublicBase()) return new Response("Not found", { status: 404 })

  const segments = (await context.params).path
  const root = path.resolve(process.cwd(), "public")

  // Reject anything that is not `<ALLOWED_PREFIX>/<name>/<name>.<ext>`.
  // The gallery layout is `uploads/gallery/<eventId>/<photoId>.jpg` — four
  // segments — and the pre-existing CMS uploads use two, so allow both.
  const safe = segments.filter((segment) => segment.length > 0)
  if (safe.length < 2 || safe.length > 4) return new Response("Not found", { status: 404 })
  if (safe.some((segment) => segment === "." || segment === ".." || segment.includes("\0"))) {
    return new Response("Not found", { status: 404 })
  }
  if (safe[0] !== ALLOWED_PREFIX) return new Response("Not found", { status: 404 })
  if (!safe.every((segment) => /^[A-Za-z0-9._-]+$/.test(segment))) {
    return new Response("Not found", { status: 404 })
  }

  const target = path.resolve(root, safe.join("/"))
  // Containment check: `path.resolve` collapses `..` before we get here, so
  // re-assert that the result is still under public/.
  const relative = path.relative(root, target)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return new Response("Not found", { status: 404 })
  }

  const extension = path.extname(target).toLowerCase()
  const contentType = CONTENT_TYPES[extension]
  if (!contentType) return new Response("Not found", { status: 404 })

  try {
    const info = await stat(target)
    if (!info.isFile()) return new Response("Not found", { status: 404 })

    const stream = Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        // Media content is immutable per key, so it is safe to cache hard.
        // Without this every TV re-fetches every photo on every playlist cycle.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new Response("Not found", { status: 404 })
  }
}