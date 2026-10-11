import type { GalleryEvent } from "@vaart/database"
import type { RateLimitRule } from "./rate-limit"

/** Header the public page sends the upload token in (never a cookie). */
export const GALLERY_TOKEN_HEADER = "x-gallery-token"

/** Field name the honeypot input uses. Real people never fill this in. */
export const HONEYPOT_FIELD = "hp"

/** Multipart overhead allowance when checking Content-Length up front. */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024

/** Fixed server-side limits (ARCHITECTURE §7.3). Event rows override what they can. */
export const LIMITS = {
  perIp: { limit: 20, windowMs: 10 * 60_000 } satisfies RateLimitRule,
  global: { limit: 120, windowMs: 60_000 } satisfies RateLimitRule,
  maxProcessingMs: 15_000,
} as const

export type GalleryLimitsEvent = Pick<
  GalleryEvent,
  "maxFilesPerRequest" | "maxFileBytes" | "maxPending"
>

export function perTokenRule(
  event: Pick<GalleryEvent, "perTokenCap">,
): RateLimitRule {
  return { limit: event.perTokenCap, windowMs: 6 * 60 * 60_000 }
}

export function publicLimits(event: GalleryLimitsEvent) {
  return {
    maxFiles: event.maxFilesPerRequest,
    maxFileBytes: event.maxFileBytes,
    maxPending: event.maxPending,
  }
}