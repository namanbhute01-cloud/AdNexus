import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { hasR2Config } from "./config"

/**
 * Private (quarantine) storage for unapproved community-gallery submissions.
 *
 * NOTHING here may ever be reachable from a public URL. Local files live under
 * `GALLERY_PRIVATE_DIR` (default `<cwd>/.data/gallery`), which is outside
 * `apps/web/public/`. R2 objects live under `gallery/pending/`, a prefix that
 * must not be covered by the bucket's public dev URL.
 */
export interface PrivateStore {
  readonly driver: "local" | "r2"
  put(key: string, body: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<{ body: Buffer; contentType: string }>
  delete(key: string): Promise<void>
}

export const GALLERY_PENDING_PREFIX = "gallery/pending"

/**
 * Gallery keys are always `<eventId>/<uuid>.jpg` or `<eventId>/<uuid>.thumb.jpg`
 * (server-generated). Anything outside that shape is rejected before it ever
 * reaches the filesystem or a bucket path — this is the traversal guard for
 * INSTRUCTIONS hard rule 4. Because every segment must be non-empty and drawn
 * from `[A-Za-z0-9_-]`, `.` and `..` can never form a segment.
 */
const KEY_PATTERN = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/

export function isValidGalleryKey(key: string): boolean {
  if (typeof key !== "string" || key.length === 0 || key.length > 200) return false
  if (key.includes("..") || key.includes("\\") || key.includes("\0")) return false
  if (key.startsWith("/") || path.isAbsolute(key)) return false
  return KEY_PATTERN.test(key)
}

function assertKey(key: string): string {
  if (!isValidGalleryKey(key)) {
    throw new Error("Invalid gallery storage key")
  }
  return key
}

// ---------------------------------------------------------------------------
// Local driver
// ---------------------------------------------------------------------------

export function resolvePrivateDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.GALLERY_PRIVATE_DIR?.trim()
  return path.resolve(configured && configured !== "dummy" ? configured : path.join(process.cwd(), ".data", "gallery"))
}

class LocalPrivateStore implements PrivateStore {
  readonly driver = "local" as const

  constructor(private readonly baseDir: string) {}

  private resolve(key: string): string {
    const target = path.resolve(this.baseDir, assertKey(key))
    // Belt-and-braces: the key pattern already forbids traversal, but re-assert
    // containment after resolution in case the base dir itself is odd.
    const relative = path.relative(this.baseDir, target)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Resolved path escapes the gallery private directory")
    }
    return target
  }

  async put(key: string, body: Buffer): Promise<void> {
    const target = this.resolve(key)
    await mkdir(path.dirname(target), { recursive: true })
    // `wx` refuses to clobber an existing file; gallery keys are UUID-based so a
    // collision means something is wrong and silently overwriting would be worse.
    await writeFile(target, body, { flag: "wx" }).catch(async (error: unknown) => {
      if ((error as NodeJS.ErrnoException)?.code === "EEXIST") return
      throw error
    })
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string }> {
    return { body: await readFile(this.resolve(key)), contentType: contentTypeFor(key) }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true })
  }
}

// ---------------------------------------------------------------------------
// R2 driver
// ---------------------------------------------------------------------------

class R2PrivateStore implements PrivateStore {
  readonly driver = "r2" as const
  private readonly client: S3Client
  private readonly bucket: string

  constructor(env: NodeJS.ProcessEnv) {
    this.bucket = env.R2_BUCKET_NAME as string
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
      },
    })
  }

  private objectKey(key: string): string {
    return `${GALLERY_PENDING_PREFIX}/${assertKey(key)}`
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(key),
        Body: body,
        ContentType: contentType,
      }),
    )
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string }> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
    )
    const bytes = await result.Body?.transformToByteArray()
    if (!bytes) throw new Error("Empty object body")
    return {
      body: Buffer.from(bytes),
      contentType: result.ContentType ?? contentTypeFor(key),
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(key) }),
    )
  }
}

function contentTypeFor(key: string): string {
  return key.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg"
}

// ---------------------------------------------------------------------------

let cached: PrivateStore | null = null

export function createPrivateStore(env: NodeJS.ProcessEnv = process.env): PrivateStore {
  if (hasR2Config(env)) return new R2PrivateStore(env)
  return new LocalPrivateStore(resolvePrivateDir(env))
}

export function getPrivateStore(env: NodeJS.ProcessEnv = process.env): PrivateStore {
  if (!cached) cached = createPrivateStore(env)
  return cached
}

/** Test seam: drop the memoised driver so env changes take effect. */
export function resetPrivateStore(): void {
  cached = null
}