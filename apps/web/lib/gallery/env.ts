/**
 * Gallery environment validation.
 *
 * Deliberately lazy: `requireGalleryEnv()` is called from gallery route handlers
 * only, so a missing secret cannot take down unrelated routes or crash the app at
 * import time. INSTRUCTIONS T4: "fails fast at boot if missing or < 32 chars
 * (only when gallery routes are hit)".
 */

const MIN_SECRET_LENGTH = 32

export class GalleryConfigError extends Error {
  readonly code = "GALLERY_MISCONFIGURED"

  constructor(message: string) {
    super(message)
    this.name = "GalleryConfigError"
  }
}

function requireSecret(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new GalleryConfigError(
      `${name} is not set. Generate one with: openssl rand -hex 32`,
    )
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new GalleryConfigError(`${name} must be at least ${MIN_SECRET_LENGTH} characters`)
  }
  if (value === "dummy") {
    throw new GalleryConfigError(`${name} is still the placeholder value "dummy"`)
  }
  return value
}

export type GalleryEnv = {
  tokenSecret: string
  ipSalt: string
  publicBaseUrl: string
  trustCloudflareHeader: boolean
}

export function requireGalleryEnv(): GalleryEnv {
  const tokenSecret = requireSecret("GALLERY_TOKEN_SECRET")
  const ipSalt = requireSecret("GALLERY_IP_SALT")

  const rawBase = process.env.PUBLIC_BASE_URL?.trim()
  const publicBaseUrl = (rawBase && rawBase !== "dummy" ? rawBase : "").replace(/\/$/, "")
  if (!publicBaseUrl) {
    throw new GalleryConfigError(
      "PUBLIC_BASE_URL is not set. It is the origin printed in the QR code, so it must be the address students' phones can reach.",
    )
  }

  return {
    tokenSecret,
    ipSalt,
    publicBaseUrl,
    trustCloudflareHeader: process.env.TRUST_CF_HEADER === "true",
  }
}

/** Non-throwing variant for pages that can degrade (e.g. the QR panel). */
export function isGalleryConfigured(): boolean {
  try {
    requireGalleryEnv()
    return true
  } catch {
    return false
  }
}