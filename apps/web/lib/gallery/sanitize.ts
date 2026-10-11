/**
 * Input sanitisation for free-text contributed by anonymous students.
 *
 * These strings are shown to an admin in a React context (auto-escaped), but
 * they also flow into `<img alt>` and into logs, so control characters and
 * zero-width joiners are stripped rather than merely escaped.
 */

// C0/C1 controls, DEL, bidi overrides, zero-width and BOM characters.
// Zero-width matters specifically: "A\u200Bdmin" is a classic way to disguise
// an admin name in a moderation list.
const UNSAFE_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g

// Whitespace-ish controls are separated out because they carry meaning: they
// should become a space, not vanish. Doing this first is what makes
// "line\nbreak" read as "line break" instead of "linebreak".
const WHITESPACE_CONTROLS = /[\t\n\v\f\r]+/g

export const MAX_NAME_LENGTH = 60
export const MAX_CAPTION_LENGTH = 140
export const MAX_REJECT_REASON_LENGTH = 200
export const MAX_SLUG_LENGTH = 64

export function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null

  const cleaned = value
    .replace(WHITESPACE_CONTROLS, " ")
    .replace(UNSAFE_CHARS, "")
    // Collapse runs of whitespace so "a   b" and "a\n\nb" look the same.
    .replace(/\s+/g, " ")
    .trim()

  if (cleaned.length === 0) return null
  // Slice by code point so a multi-byte character is never split in half.
  return Array.from(cleaned).slice(0, maxLength).join("")
}

export function sanitizeName(value: unknown): string | null {
  return sanitizeText(value, MAX_NAME_LENGTH)
}

export function sanitizeCaption(value: unknown): string | null {
  return sanitizeText(value, MAX_CAPTION_LENGTH)
}

export function sanitizeRejectReason(value: unknown): string | null {
  return sanitizeText(value, MAX_REJECT_REASON_LENGTH)
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function sanitizeSlug(value: unknown): string | null {
  const cleaned = sanitizeText(value, MAX_SLUG_LENGTH)
  if (!cleaned) return null

  const slug = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug) ? slug : null
}