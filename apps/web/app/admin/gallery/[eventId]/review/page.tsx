import { notFound } from "next/navigation"
import { prisma } from "@vaart/database"
import { GalleryReview } from "@/components/gallery-review"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ eventId: string }> }

export default async function GalleryReviewPage({ params }: Props) {
  const { eventId } = await params

  const event = await prisma.galleryEvent.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  })

  if (!event) notFound()

  return <GalleryReview eventId={event.id} eventName={event.name} />
}