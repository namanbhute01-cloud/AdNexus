import { prisma } from "@vaart/database"
import { requireGalleryEnv } from "@/lib/gallery/env"
import { GalleryConsole } from "@/components/gallery-console"

export const dynamic = "force-dynamic"

export default async function GalleryPage() {
  // The page lives under /admin/*, whose layout already enforces ADMIN, but we
  // still fail loudly rather than rendering a broken QR if the secrets are
  // missing — that is the operator's cue to fix .env.local.
  let publicBaseUrl: string
  try {
    publicBaseUrl = requireGalleryEnv().publicBaseUrl
  } catch (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Community Gallery</h1>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <p className="font-medium">Gallery is not configured.</p>
          <p className="mt-2">{error instanceof Error ? error.message : String(error)}</p>
          <p className="mt-3">
            Add <code>GALLERY_TOKEN_SECRET</code>, <code>GALLERY_IP_SALT</code> and{" "}
            <code>PUBLIC_BASE_URL</code> to <code>apps/web/.env.local</code>, then restart.
          </p>
        </div>
      </div>
    )
  }

  const [events, campaigns] = await Promise.all([
    prisma.galleryEvent.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { photos: true } } },
    }),
    prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, _count: { select: { media: true } } },
    }),
  ])

  return (
    <GalleryConsole
      publicBaseUrl={publicBaseUrl}
      campaigns={campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        mediaCount: c._count.media,
      }))}
      events={events.map((event) => ({
        id: event.id,
        slug: event.slug,
        name: event.name,
        campaignId: event.campaignId,
        isOpen: event.isOpen,
        displaySeconds: event.displaySeconds,
        maxFileBytes: event.maxFileBytes,
        totalPhotos: event._count.photos,
        createdAt: event.createdAt.toISOString(),
      }))}
    />
  )
}