import type { Metadata, Viewport } from "next"
import { notFound } from "next/navigation"
import { prisma } from "@vaart/database"
import { ContributeClient } from "./contribute-client"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

/**
 * The QR landing page. Never indexed — it is an event-scoped intake form, not
 * content. The `noindex` robots meta is belt-and-braces; `next.config.ts` also
 * sets `X-Robots-Tag` for `/contribute/:path*`.
 */
export const metadata: Metadata = {
  title: "Share your photos",
  // Overrides the CMS-wide description inherited from the root layout — this is
  // a student-facing page, not an operator console.
  description: "Upload your event photos to be shown on the campus screens after review.",
  robots: { index: false, follow: false, nocache: true },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f172a",
}

export default async function ContributePage({ params }: Props) {
  const { slug } = await params

  const event = await prisma.galleryEvent.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, isOpen: true },
  })

  if (!event) notFound()

  return <ContributeClient slug={event.slug} name={event.name} open={event.isOpen} />
}