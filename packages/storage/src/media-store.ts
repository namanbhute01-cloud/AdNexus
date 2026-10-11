import { copyFile, mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getR2PublicBase, hasR2Config, type EnvLike } from "./config"
import { resolvePrivateDir, type PrivateStore } from "./private-store"

/**
 * Promotion of an approved gallery photo into the *existing* media storage
 * location, so the player treats it like any other uploaded asset.
 *
 * The key is derived deterministically from the photo id, which is what makes
 * approval idempotent: a retried or concurrent approval writes the same object
 * and produces the same `Media.r2Key`, so the database unique index is the only
 * thing that has to arbitrate (see DECISIONS D3).
 */
export interface PromotedMedia {
  /** Value stored in `Media.r2Key` (unique). */
  r2Key: string
  /** Value stored in `Media.url` — what the player loads. */
  url: string
  /** Absolute path for the local driver; unused for R2. */
  localPath: string | null
}

const APPROVED_LOCAL_PREFIX = "uploads/gallery"
const APPROVED_R2_PREFIX = "gallery/approved"

/** `apps/web/public/...` — the directory the existing local upload path writes to. */
export function resolvePublicDir(env: EnvLike = process.env): string {
  return path.resolve(process.cwd(), "public")
}

function keyFor(eventId: string, photoId: string): string {
  return `${eventId}/${photoId}.jpg`
}

export async function promoteGalleryPhoto(
  privateStore: PrivateStore,
  eventId: string,
  photoId: string,
  env: EnvLike = process.env,
): Promise<PromotedMedia> {
  const key = keyFor(eventId, photoId)
  const { body, contentType } = await privateStore.get(key)

  if (hasR2Config(env)) {
    const r2Key = `${APPROVED_R2_PREFIX}/${key}`
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
      },
    })
    await client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME as string,
        Key: r2Key,
        Body: body,
        ContentType: contentType,
      }),
    )
    const publicBase = getR2PublicBase(env)
    if (!publicBase) {
      throw new Error("R2 is configured but R2_PUBLIC_URL is not; approved media would be unreachable")
    }
    return { r2Key, url: `${publicBase}/${r2Key}`, localPath: null }
  }

  const r2Key = `${APPROVED_LOCAL_PREFIX}/${key}`
  const target = path.resolve(resolvePublicDir(env), r2Key)
  const relative = path.relative(resolvePublicDir(env), target)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Refusing to promote a file outside public/")
  }
  await mkdir(path.dirname(target), { recursive: true })
  // Plain overwrite is correct here: the key is content-addressed by photo id
  // and re-approval of the same photo must reproduce the same bytes.
  await copyFile(path.join(resolvePrivateDir(env), key), target)

  // Mirror `app/api/media/route.ts`: an `uploads/` key is served straight from
  // `public/` by Next, so the URL is root-relative.
  return { r2Key, url: `/${r2Key}`, localPath: target }
}

export async function deletePromotedGalleryPhoto(
  promoted: PromotedMedia,
  env: EnvLike = process.env,
): Promise<void> {
  try {
    if (promoted.localPath) {
      await rm(promoted.localPath, { force: true })
      return
    }
    if (!hasR2Config(env)) return
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
      },
    })
    await client.send(
      new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME as string, Key: promoted.r2Key }),
    )
  } catch {
    // Cleanup is best-effort: an orphaned file must never fail an approval or a
    // rejection. The RUNBOOK teardown step sweeps leftovers.
  }
}