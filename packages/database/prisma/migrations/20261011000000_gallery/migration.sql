-- Community Gallery: event intake + moderation queue.
-- Additive only: creates one enum and two tables. Touches no existing object.

-- CreateEnum
CREATE TYPE "GalleryPhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REMOVED');

-- CreateTable
CREATE TABLE "GalleryEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "maxFilesPerRequest" INTEGER NOT NULL DEFAULT 5,
    "maxFileBytes" INTEGER NOT NULL DEFAULT 10485760,
    "maxPending" INTEGER NOT NULL DEFAULT 500,
    "perTokenCap" INTEGER NOT NULL DEFAULT 30,
    "displaySeconds" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryPhoto" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "GalleryPhotoStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT NOT NULL,
    "thumbKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "contributorName" TEXT,
    "caption" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "mediaId" TEXT,
    "campaignMediaId" TEXT,

    CONSTRAINT "GalleryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GalleryEvent_slug_key" ON "GalleryEvent"("slug");

-- CreateIndex
CREATE INDEX "GalleryPhoto_eventId_status_createdAt_idx" ON "GalleryPhoto"("eventId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryPhoto_eventId_sha256_key" ON "GalleryPhoto"("eventId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryPhoto_mediaId_key" ON "GalleryPhoto"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryPhoto_campaignMediaId_key" ON "GalleryPhoto"("campaignMediaId");

-- AddForeignKey
ALTER TABLE "GalleryPhoto" ADD CONSTRAINT "GalleryPhoto_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GalleryEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;