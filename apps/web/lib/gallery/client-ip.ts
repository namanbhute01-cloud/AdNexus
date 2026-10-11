import { createHmac } from "node:crypto"
import { requireGalleryEnv } from "./env"

type EnvLike = Record<string, string | undefined>

/**
 * Client IP resolution and pseudonymisation.
 *
 * Raw IPs are never stored (INSTRUCTIONS rule 9). We keep only a truncated
 * HMAC, which is stable for the length of a salt's life — enough to rate-limit
 * one phone — but not reversible without the salt.
 */

/**
 * Resolve the caller's IP.
 *
 * `cf-connecting-ip` is trusted ONLY when `TRUST_CF_HEADER=true`, because that
 * header is trivially spoofable by anyone talking to the origin directly. When
 * we are not behind Cloudflare, use the socket address via `x-forwarded-for`'s
 * first hop, which is the client when there is exactly one trusted proxy in
 * front (the documented deployment).
 */
export function getClientIp(req: Request, env: EnvLike = process.env): string {
  if (env.TRUST_CF_HEADER === "true") {
    const cf = req.headers.get("cf-connecting-ip")
    if (cf) return cf.trim()
  }

  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }

  return req.headers.get("x-real-ip")?.trim() || "unknown"
}

export function hashIp(ip: string, salt: string): string {
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 16)
}

/** Convenience wrapper that pulls the salt from validated gallery env. */
export function hashClientIp(req: Request): string {
  const { ipSalt } = requireGalleryEnv()
  return hashIp(getClientIp(req), ipSalt)
}