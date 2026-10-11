import assert from "node:assert/strict"
import { crc32 } from "node:zlib"
import sharp from "sharp"
import {
  FULL_MAX_EDGE,
  MAX_INPUT_PIXELS,
  PipelineError,
  activeProcessors,
  processUpload,
  resetSemaphore,
  sniffImageType,
} from "@/lib/gallery/image-pipeline"

/** Deterministic RGB noise so two "different" fixtures are never identical. */
async function noiseBuffer(width: number, height: number, seed = 1): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3)
  let state = seed >>> 0
  for (let i = 0; i < pixels.length; i += 3) {
    state = (state * 1664525 + 1013904223) >>> 0
    pixels[i] = (state >>> 24) & 0xff
    state = (state * 1664525 + 1013904223) >>> 0
    pixels[i + 1] = (state >>> 24) & 0xff
    state = (state * 1664525 + 1013904223) >>> 0
    pixels[i + 2] = (state >>> 24) & 0xff
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer()
}

const jpeg = (w: number, h: number, seed = 1) => noiseBuffer(w, h, seed).then((b) => sharp(b).jpeg().toBuffer())
const png = (w: number, h: number, seed = 2) => noiseBuffer(w, h, seed)
const webp = (w: number, h: number, seed = 3) => noiseBuffer(w, h, seed).then((b) => sharp(b).webp().toBuffer())

/**
 * A *structurally valid* PNG whose IHDR claims a huge canvas, without allocating
 * it. sharp reads dimensions from IHDR and enforces `limitInputPixels` before it
 * ever touches pixel data, which is exactly the path we want to test.
 */
async function oversizedPngHeader(width: number, height: number): Promise<Buffer> {
  const small = await sharp(await noiseBuffer(8, 8, 21), { raw: { width: 8, height: 8, channels: 3 } })
    .png()
    .toBuffer()

  // IHDR data starts at byte 16 (8 signature + 4 length + 4 type); its CRC is
  // the 4 bytes at 29. Rewrite both so the header stays checksum-valid.
  const patched = Buffer.from(small)
  patched.writeUInt32BE(width, 16)
  patched.writeUInt32BE(height, 20)
  patched.writeUInt32BE(crc32(patched.subarray(12, 29)), 29)
  return patched
}

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (error: unknown) => {
    assert.ok(error instanceof PipelineError, `expected PipelineError, got ${String(error)}`)
    assert.equal(error.code, code)
    return true
  })
}

async function main() {
  resetSemaphore()
  let passed = 0

  const test = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn()
      passed += 1
      console.log(`  ok  ${name}`)
    } catch (error) {
      console.error(`  FAIL ${name}`)
      console.error(error)
      process.exitCode = 1
    }
  }

  // -------------------------------------------------------------------------
  console.log("\nmagic-byte sniffing")

  await test("sniffs JPEG, PNG and WebP", () => {
    assert.equal(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), "jpeg")
    assert.equal(
      sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])),
      "png",
    )
    const riff = Buffer.alloc(12)
    riff.write("RIFF", 0, "ascii")
    riff.write("WEBP", 8, "ascii")
    assert.equal(sniffImageType(riff), "webp")
  })

  await test("rejects non-image magic bytes", () => {
    assert.equal(sniffImageType(Buffer.from("MZ\0\0this is a windows exe....")), null)
    assert.equal(sniffImageType(Buffer.from('<?xml version="1.0"?><svg/>')), null)
    assert.equal(sniffImageType(Buffer.from("<!DOCTYPE html><html></html>")), null)
    assert.equal(sniffImageType(Buffer.alloc(0)), null)
  })

  // -------------------------------------------------------------------------
  console.log("\nvalid images pass")

  for (const [name, make] of [
    ["JPEG", () => jpeg(900, 600)],
    ["PNG", () => png(900, 600)],
    ["WebP", () => webp(900, 600)],
  ] as const) {
    await test(`${name} is re-encoded to JPEG with a thumbnail`, async () => {
      const result = await processUpload(await make())
      assert.equal(result.full.length > 0, true)
      assert.equal(result.thumb.length > 0, true)
      assert.equal(result.sizeBytes, result.full.length)
      assert.equal(result.sha256.length, 64)
      assert.equal((await sharp(result.full).metadata()).format, "jpeg")
      assert.equal((await sharp(result.thumb).metadata()).format, "jpeg")
    })
  }

  await test("thumbnail is smaller than the full-size image", async () => {
    const result = await processUpload(await jpeg(2000, 1500))
    assert.equal(result.thumb.length < result.full.length, true)
    const thumbMeta = await sharp(result.thumb).metadata()
    assert.equal(Math.max(thumbMeta.width ?? 0, thumbMeta.height ?? 0) <= 480, true)
  })

  await test("output is capped at 2560px on the longest edge", async () => {
    const result = await processUpload(await jpeg(5000, 3000, 9))
    assert.equal(result.width, FULL_MAX_EDGE)
    assert.equal(result.height, Math.round((3000 / 5000) * FULL_MAX_EDGE))
  })

  await test("small images are never upscaled", async () => {
    const result = await processUpload(await jpeg(120, 90))
    assert.equal(result.width, 120)
    assert.equal(result.height, 90)
  })

  await test("identical input yields an identical sha256 (de-dupe)", async () => {
    const source = await jpeg(640, 480, 42)
    const a = await processUpload(source)
    const b = await processUpload(source)
    assert.equal(a.sha256, b.sha256)
  })

  await test("different images yield different sha256", async () => {
    const a = await processUpload(await jpeg(320, 240, 1))
    const b = await processUpload(await jpeg(320, 240, 777))
    assert.notEqual(a.sha256, b.sha256)
  })

  // -------------------------------------------------------------------------
  console.log("\nhostile input is rejected")

  await test("text file renamed .jpg is rejected", async () => {
    const text = Buffer.from('alert("pwned")\n'.repeat(200))
    await expectCode(() => processUpload(text), "BAD_TYPE")
  })

  await test("SVG renamed .png is rejected", async () => {
    const svg = Buffer.from(
      `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>`.repeat(40),
    )
    await expectCode(() => processUpload(svg), "BAD_TYPE")
  })

  await test("HTML page is rejected", async () => {
    await expectCode(
      () => processUpload(Buffer.from("<!DOCTYPE html><html><body>hi</body></html>")),
      "BAD_TYPE",
    )
  })

  await test("truncated JPEG is rejected", async () => {
    const full = await jpeg(800, 600)
    const truncated = full.subarray(0, Math.floor(full.length * 0.4))
    await expectCode(() => processUpload(truncated), "BAD_IMAGE")
  })

  await test("polyglot (valid JPEG + appended script) is rejected or safely stripped", async () => {
    const full = await jpeg(400, 300)
    const polyglot = Buffer.concat([full, Buffer.from("\n<script>alert(1)</script>\n")])
    try {
      const result = await processUpload(polyglot)
      // If sharp tolerates the trailing bytes, the OUTPUT must be a clean JPEG
      // that never contains the appended script.
      const meta = await sharp(result.full).metadata()
      assert.equal(meta.format, "jpeg")
      assert.equal(result.full.includes(Buffer.from("<script>")), false)
    } catch (error) {
      assert.ok(error instanceof PipelineError)
      assert.equal(["BAD_IMAGE", "BAD_TYPE"].includes(error.code), true)
    }
  })

  await test("oversized-dimension PNG is rejected by the pixel limit", async () => {
    // 9000x6000 = 54 MP, over the 50 MP ceiling. Valid header, no real pixels.
    const header = await oversizedPngHeader(9000, 6000)
    assert.equal(sniffImageType(header), "png")
    await expectCode(() => processUpload(header), "TOO_LARGE_PIXELS")

    // 7000x7000 = 49 MP is *under* the ceiling and must NOT trip the guard.
    const underLimit = await oversizedPngHeader(7000, 7000)
    await processUpload(underLimit).then(
      () => assert.fail("a pixel-less PNG must not decode"),
      (error: PipelineError) => assert.equal(error.code, "BAD_IMAGE"),
    )
    assert.equal(MAX_INPUT_PIXELS, 50_000_000)
  })

  await test("empty buffer is rejected", async () => {
    await expectCode(() => processUpload(Buffer.alloc(0)), "BAD_IMAGE")
  })

  // -------------------------------------------------------------------------
  console.log("\nEXIF privacy")

  await test("GPS metadata is stripped from the output", async () => {
    const withExif = await sharp({
      create: { width: 64, height: 48, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .jpeg()
      .withExifMerge({
        IFD0: { Copyright: "test", Make: "TestCam" },
        GPS: {
          GPSLatitudeRef: "N",
          GPSLatitude: "12/1 58/1 16/1",
          GPSLongitudeRef: "E",
          GPSLongitude: "77/1 35/1 40/1",
        },
      } as unknown as Parameters<ReturnType<typeof sharp>["withExifMerge"]>[0])
      .toBuffer()

    const source = await sharp(withExif).metadata()
    assert.equal(source.exif !== undefined, true, "fixture must actually carry EXIF or the test is vacuous")

    const result = await processUpload(withExif)
    const meta = await sharp(result.full).metadata()
    assert.equal(meta.exif, undefined, "EXIF (and therefore GPS) must not survive the re-encode")

    const raw = result.full.toString("latin1")
    assert.equal(raw.includes("GPSLatitude"), false)
    assert.equal(raw.includes("TestCam"), false)
  })

  await test("EXIF orientation is applied, not merely carried over", async () => {
    // A 100x50 image tagged "rotate 90 CW" must come out 50x100.
    const source = await noiseBuffer(100, 50, 5)
    const tagged = await sharp(source).withMetadata({ orientation: 6 }).jpeg().toBuffer()
    assert.equal((await sharp(tagged).metadata()).orientation, 6, "fixture must carry a real orientation tag")

    const result = await processUpload(tagged)
    assert.equal(result.width, 50)
    assert.equal(result.height, 100)
  })

  // -------------------------------------------------------------------------
  console.log("\nconcurrency gate")

  await test("more than three concurrent uploads are rejected with BUSY", async () => {
    resetSemaphore()
    const source = await jpeg(2000, 1500, 11)
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => processUpload(source)),
    )
    const busy = results.filter(
      (r) => r.status === "rejected" && (r.reason as PipelineError)?.code === "BUSY",
    )
    assert.equal(busy.length >= 1, true, "expected at least one BUSY rejection")
    assert.equal(activeProcessors(), 0, "semaphore must drain fully")
  })

  await test("a failed upload releases its slot", async () => {
    resetSemaphore()
    await expectCode(() => processUpload(Buffer.from("not an image")), "BAD_TYPE")
    assert.equal(activeProcessors(), 0)
    const result = await processUpload(await jpeg(200, 200))
    assert.equal(result.full.length > 0, true)
  })

  // -------------------------------------------------------------------------
  console.log(`\n${passed} image-pipeline assertions passed`)
  resetSemaphore()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})