/**
 * Storage configuration.
 *
 * These checks deliberately mirror the ones already used by the CMS upload path
 * (`apps/web/app/api/media/upload-url/route.ts`): R2 is considered configured
 * only when all four credentials are present and none of them is the literal
 * string "dummy". Anything else falls back to local disk, which is the
 * "degrades gracefully" behaviour the base product already relies on.
 */

export function isConfigured(value: string | undefined | null): boolean {
  return Boolean(value && value.trim() && value.trim() !== "dummy")
}

export function hasR2Config(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    isConfigured(env.R2_ACCOUNT_ID) &&
    isConfigured(env.R2_ACCESS_KEY_ID) &&
    isConfigured(env.R2_SECRET_ACCESS_KEY) &&
    isConfigured(env.R2_BUCKET_NAME)
  )
}

/** Public base URL for R2-served objects, or null when R2 is not usable. */
export function getR2PublicBase(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!hasR2Config(env)) return null
  const base = env.R2_PUBLIC_URL?.trim()
  return base && base !== "dummy" ? base.replace(/\/$/, "") : null
}