import { z } from "zod"

/** Shared validators + response shapes for /api/admin/gallery/**. */

export const eventCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase words separated by single hyphens"),
  campaignId: z.string().trim().min(1),
  maxFilesPerRequest: z.number().int().min(1).max(20).optional(),
  maxFileBytes: z.number().int().min(1024).max(25 * 1024 * 1024).optional(),
  maxPending: z.number().int().min(1).max(10_000).optional(),
  perTokenCap: z.number().int().min(1).max(500).optional(),
  displaySeconds: z.number().int().min(1).max(120).optional(),
})

export const eventPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    campaignId: z.string().trim().min(1).optional(),
    isOpen: z.boolean().optional(),
    maxFilesPerRequest: z.number().int().min(1).max(20).optional(),
    maxFileBytes: z.number().int().min(1024).max(25 * 1024 * 1024).optional(),
    maxPending: z.number().int().min(1).max(10_000).optional(),
    perTokenCap: z.number().int().min(1).max(500).optional(),
    displaySeconds: z.number().int().min(1).max(120).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "empty patch" })

export const photoListSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "REMOVED"]).default("PENDING"),
  cursor: z.string().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(60),
})

export const rejectSchema = z.object({
  reason: z.string().trim().max(200).optional().nullable(),
})

export const bulkSchema = z.object({
  action: z.enum(["approve", "reject", "remove"]),
  ids: z.array(z.string().min(1)).min(1).max(50),
  reason: z.string().trim().max(200).optional().nullable(),
})

export type GalleryPhotoDto = {
  id: string
  eventId: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "REMOVED"
  width: number
  height: number
  sizeBytes: number
  contributorName: string | null
  caption: string | null
  createdAt: string
  reviewedAt: string | null
  rejectReason: string | null
}

/**
 * Photos never carry `sha256`, `ipHash` or storage keys out of the admin API —
 * there is no UI that needs them, and `sha256`/`ipHash` are de-dup and abuse
 * signals we do not want in a browser payload.
 */
export function toPhotoDto<T extends GalleryPhotoDto>(photo: T): T {
  return photo
}