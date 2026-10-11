import { prisma } from "@vaart/database"
import { getPrivateStore } from "@vaart/storage"
import { requireAdmin } from "@/lib/gallery/require-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ id: string }> }

/**
 * Streams a quarantined photo to an authenticated admin. This is the ONLY way a
 * pending image ever leaves the private store — there is no public URL for it,
 * and `Cache-Control: private, no-store` stops it being cached by a proxy on the
 * way out.
 */
export async function GET(req: Request, context: Context) {
  const { response } = await requireAdmin()
  if (response) return response

  const { id } = await context.params
  const variant = new URL(req.url).searchParams.get("v") === "full" ? "full" : "thumb"

  const photo = await prisma.galleryPhoto.findUnique({
    where: { id },
    select: { id: true, storageKey: true, thumbKey: true },
  })
  if (!photo) return new Response("Not found", { status: 404 })

  const key = variant === "thumb" ? photo.thumbKey : photo.storageKey

  try {
    const { body, contentType } = await getPrivateStore().get(key)
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(body.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    })
  } catch (error) {
    console.error("[gallery] failed to stream photo:", error)
    return new Response("Not found", { status: 404 })
  }
}