import { createHash } from "node:crypto"
import sharp from "sharp"

// One thread per worker process. sharp's default is libvips' own core count,
// which on a laptop with 8+ cores means a single upload can saturate the box
// and starve the moderation UI during the event.
sharp.concurrency(2)
sharp.cache(false)

export const MAX_INPUT_PIXELS = 50_000_000
export const PROCESS_TIMEOUT_MS = 15_000
export const FULL_MAX_EDGE = 2560
export const THUMB_MAX_EDGE = 480

export type PipelineErrorCode =
  | "BAD_TYPE"
  | "BAD_IMAGE"
  | "TOO_LARGE_PIXELS"
  | "TIMEOUT"
  | "BUSY"

export class PipelineError extends Error {
  constructor(
    readonly code: PipelineErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "PipelineError"
  }
}

export type ProcessUploadResult = {
  full: Buffer
  thumb: Buffer
  width: number
  height: number
  sizeBytes: number
  sha256: string
}

export function sniffImageType(buffer: Buffer): "jpeg" | "png" | "webp" | null {
  if (buffer.length < 12) return null

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg"

  // 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png"
  }

  // RIFF....WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp"
  }

  return null
}

// ---------------------------------------------------------------------------
// Concurrency gate
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 3
let active = 0

export function activeProcessors(): number {
  return active
}

/** Reset between tests so a leaked slot cannot poison the suite. */
export function resetSemaphore(): void {
  active = 0
}

/**
 * Sharp work is CPU-bound. Three concurrent uploads on a laptop already peg it;
 * more just makes every request slower and can blow the event server's heap.
 * Rejecting fast with BUSY is better than queueing unboundedly.
 */
function withSemaphore<T>(work: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    return Promise.reject(new PipelineError("BUSY", "Too many uploads in flight"))
  }
  active += 1
  return work().finally(() => {
    active -= 1
  })
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function basePipeline(input: Buffer) {
  return sharp(input, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: "error",
    sequentialRead: true,
  })
}

async function encode(input: Buffer, maxEdge: number, quality: number) {
  // `.rotate()` with no argument applies the EXIF orientation tag and is a no-op
  // for images without one. Metadata (including GPS) is dropped by default
  // because we never copy it to the output.
  return basePipeline(input)
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()
}

export async function processUpload(buffer: Buffer): Promise<ProcessUploadResult> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new PipelineError("BAD_IMAGE", "Empty upload")
  }

  const sniffed = sniffImageType(buffer)
  if (!sniffed) {
    // Covers renamed .exe/.svg/.html, polyglots and scripts: the declared type
    // is never trusted, only the magic bytes.
    throw new PipelineError("BAD_TYPE", `Unsupported or unrecognised image data (sniffed: ${sniffed})`)
  }

  return withSemaphore(async () => {
    let metadata: sharp.Metadata
    try {
      metadata = await basePipeline(buffer).metadata()
    } catch (error) {
      if (isPixelLimitError(error)) {
        throw new PipelineError("TOO_LARGE_PIXELS", "Image exceeds the pixel limit")
      }
      // Truncated files, corrupt headers, a valid image with a script appended.
      throw new PipelineError("BAD_IMAGE", "Image could not be decoded")
    }

    const sourcePixels = (metadata.width ?? 0) * (metadata.height ?? 0)
    if (sourcePixels > MAX_INPUT_PIXELS) {
      throw new PipelineError("TOO_LARGE_PIXELS", "Image exceeds the pixel limit")
    }

    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const work = (async () => {
        const full = await encode(buffer, FULL_MAX_EDGE, 85)
        const thumb = await encode(buffer, THUMB_MAX_EDGE, 70)
        return { full, thumb }
      })()

      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new PipelineError("TIMEOUT", "Image processing timed out")),
          PROCESS_TIMEOUT_MS,
        )
      })

      const { full, thumb } = await Promise.race([work, timeout])

      // Dimensions of the *output* (post-rotation, post-resize), because that is
      // what gets stored and what the display aspect ratio must reflect.
      const outputMeta = await sharp(full).metadata()

      return {
        full,
        thumb,
        width: outputMeta.width ?? 0,
        height: outputMeta.height ?? 0,
        sizeBytes: full.length,
        // Hash of the re-encoded bytes, so two different source photos that
        // normalise to the same picture de-duplicate correctly (DECISIONS D10).
        sha256: createHash("sha256").update(full).digest("hex"),
      }
    } catch (error) {
      if (error instanceof PipelineError) throw error
      throw new PipelineError("BAD_IMAGE", "Image could not be processed")
    } finally {
      if (timer) clearTimeout(timer)
    }
  })
}

function isPixelLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /exceeds pixel limit|Input image exceeds pixel limit/i.test(message)
}