import { notFound } from "next/navigation"
import { prisma } from "@vaart/database"
import { requireGalleryEnv } from "@/lib/gallery/env"
import { GalleryModeration } from "@/components/gallery-moderation"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ eventId: string }> }

export default async function GalleryEventPage({ params }: Props) {
  const { eventId } = await params

  const event = await prisma.galleryEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      slug: true,
      name: true,
      campaignId: true,
      isOpen: true,
      maxFilesPerRequest: true,
      maxFileBytes: true,
      maxPending: true,
      perTokenCap: true,
      displaySeconds: true,
    },
  })

  if (!event) notFound()

  let publicBaseUrl = ""
  try {
    publicBaseUrl = requireGalleryEnv().publicBaseUrl
  } catch {
    // The moderation grid still works without the QR panel; it only means the
    // operator has not set PUBLIC_BASE_URL yet.
  }

  return (
    <GalleryModeration
      event={{
        id: event.id,
        slug: event.slug,
        name: event.name,
        campaignId: event.campaignId,
        isOpen: event.isOpen,
        maxFilesPerRequest: event.maxFilesPerRequest,
        maxFileBytes: event.maxFileBytes,
        maxPending: event.maxPending,
        perTokenCap: event.perTokenCap,
        displaySeconds: event.displaySeconds,
      }}
      publicBaseUrl={publicBaseUrl}
    />
  )
}