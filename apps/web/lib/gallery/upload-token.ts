import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { requireGalleryEnv } from "./env"

/**
 * Short-lived upload tokens.
 *
 * These are NOT authentication — they exist to stop trivial scripted abuse and
 * to give each anonymous visitor a bucket to rate-limit against. They prove
 * nothing about who the sender is; the only real gate is admin moderation
 * (ARCHITECTURE §11).
 *
 * Sent as the `X-Gallery-Token` header rather than a cookie so the page works in
 * in-app browsers that block or partition third-party cookie storage.
 */

export const TOKEN_TTL_MS = 6 * 60 * 60 * 1000

export type UploadTokenPayload = {
  slug: string
  iat: number
  jti: string
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url")
}

export function signToken(slug: string, now = Date.now()): string {
  const { tokenSecret } = requireGalleryEnv()
  const payload: UploadTokenPayload = { slug, iat: Math.floor(now / 1000), jti: randomUUID() }
  const body = b64url(JSON.stringify(payload))
  return `${body}.${sign(body, tokenSecret)}`
}

export type TokenFailure =
  | "MALFORMED"
  | "BAD_SIGNATURE"
  | "WRONG_SLUG"
  | "EXPIRED"

export type VerifyResult =
  | { ok: true; payload: UploadTokenPayload }
  | { ok: false; reason: TokenFailure }

export function verifyToken(token: string | null | undefined, slug: string, now = Date.now()): VerifyResult {
  if (!token || typeof token !== "string") return { ok: false, reason: "MALFORMED" }

  const dot = token.lastIndexOf(".")
  if (dot <= 0) return { ok: false, reason: "MALFORMED" }

  const body = token.slice(0, dot)
  const signature = token.slice(dot + 1)

  let payload: UploadTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch {
    return { ok: false, reason: "MALFORMED" }
  }

  if (
    typeof payload?.slug !== "string" ||
    typeof payload?.iat !== "number" ||
    typeof payload?.jti !== "string"
  ) {
    return { ok: false, reason: "MALFORMED" }
  }

  const { tokenSecret } = requireGalleryEnv()

  const expected = sign(body, tokenSecret)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch, so length is compared first.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "BAD_SIGNATURE" }
  }

  if (payload.slug !== slug) return { ok: false, reason: "WRONG_SLUG" }

  const ageMs = now - payload.iat * 1000
  // Reject anything more than TTL old, and anything stamped in the future by more
  // than a minute (clock skew, or a forged token).
  if (ageMs > TOKEN_TTL_MS) return { ok: false, reason: "EXPIRED" }
  if (ageMs < -60_000) return { ok: false, reason: "EXPIRED" }

  return { ok: true, payload }
}