import assert from "node:assert/strict"
import { mkdtemp, readdir, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, describe, it } from "node:test"
import {
  createPrivateStore,
  isValidGalleryKey,
  resolvePrivateDir,
  type PrivateStore,
} from "@vaart/storage"

const dirs: string[] = []

async function makeStore(): Promise<{ store: PrivateStore; baseDir: string }> {
  const baseDir = await mkdtemp(path.join(tmpdir(), "gallery-private-"))
  dirs.push(baseDir)
  const store = createPrivateStore({ GALLERY_PRIVATE_DIR: baseDir })
  assert.equal(store.driver, "local")
  return { store, baseDir }
}

after(async () => {
  const { rm } = await import("node:fs/promises")
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

describe("private store round-trip", () => {
  it("puts, gets and deletes a file", async () => {
    const { store, baseDir } = await makeStore()
    const body = Buffer.from("not really a jpeg, but bytes are bytes")

    await store.put("evt_1/abc-123.jpg", body, "image/jpeg")

    const read = await store.get("evt_1/abc-123.jpg")
    assert.deepEqual(read.body, body)
    assert.equal(read.contentType, "image/jpeg")

    const onDisk = path.join(baseDir, "evt_1", "abc-123.jpg")
    assert.equal((await stat(onDisk)).size, body.length)

    await store.delete("evt_1/abc-123.jpg")
    await assert.rejects(() => store.get("evt_1/abc-123.jpg"))
  })

  it("does not clobber an existing key", async () => {
    const { store } = await makeStore()
    await store.put("evt_1/same.jpg", Buffer.from("first"), "image/jpeg")
    await store.put("evt_1/same.jpg", Buffer.from("second"), "image/jpeg")
    const read = await store.get("evt_1/same.jpg")
    assert.equal(read.body.toString(), "first")
  })

  it("delete is idempotent for a missing key", async () => {
    const { store } = await makeStore()
    await store.delete("evt_1/never-existed.jpg")
  })

  it("creates nested directories for the event id", async () => {
    const { store, baseDir } = await makeStore()
    await store.put("evt_1/deep.jpg", Buffer.from("x"), "image/jpeg")
    const entries = await readdir(path.join(baseDir, "evt_1"))
    assert.deepEqual(entries, ["deep.jpg"])
  })
})

describe("key validation rejects traversal", () => {
  const hostile = [
    "../escape.jpg",
    "../../etc/passwd",
    "evt_1/../../../etc/passwd",
    "/absolute/path.jpg",
    "evt_1\\windows.jpg",
    "evt_1/sub/deep.jpg",
    "..",
    ".",
    "evt_1/",
    "evt_1/abc.jpg/../../../x",
    "evt_1/%2e%2e%2fescape.jpg",
    "",
  ]

  for (const key of hostile) {
    it(`rejects ${JSON.stringify(key)}`, async () => {
      assert.equal(isValidGalleryKey(key), false)
      const { store } = await makeStore()
      await assert.rejects(() => store.put(key, Buffer.from("x"), "image/jpeg"))
      await assert.rejects(() => store.get(key))
      await assert.rejects(() => store.delete(key))
    })
  }

  it("accepts the server-generated shape", () => {
    assert.equal(isValidGalleryKey("evt_1/3f1c2b4a.jpg"), true)
    assert.equal(isValidGalleryKey("evt_1/3f1c2b4a.thumb.jpg"), true)
    assert.equal(isValidGalleryKey("cmv3ijql10001bd3c5ysfkcef/abc-def_123.jpg"), true)
  })

  it("never writes outside the configured base dir", async () => {
    const { store, baseDir } = await makeStore()
    const sentinel = path.join(baseDir, "sentinel.txt")
    await writeFile(sentinel, "keep me")

    await assert.rejects(() => store.put("../sentinel.txt", Buffer.from("x"), "image/jpeg"))

    assert.equal((await readdir(baseDir)).includes("sentinel.txt"), true)
    assert.equal((await readdir(baseDir)).includes("sentinel.txt.evil"), false)
  })
})

describe("driver selection", () => {
  it("uses local disk when R2 is not configured", () => {
    const store = createPrivateStore({})
    assert.equal(store.driver, "local")
  })

  it("uses local disk when R2 vars are the literal 'dummy'", () => {
    const store = createPrivateStore({
      R2_ACCOUNT_ID: "dummy",
      R2_ACCESS_KEY_ID: "dummy",
      R2_SECRET_ACCESS_KEY: "dummy",
      R2_BUCKET_NAME: "dummy",
    })
    assert.equal(store.driver, "local")
  })

  it("uses R2 when all four credentials are real", () => {
    const store = createPrivateStore({
      R2_ACCOUNT_ID: "acct",
      R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET_NAME: "bucket",
    })
    assert.equal(store.driver, "r2")
  })
})

describe("private directory default", () => {
  it("defaults to <cwd>/.data/gallery, never under public/", () => {
    const dir = resolvePrivateDir({})
    assert.equal(dir, path.resolve(process.cwd(), ".data", "gallery"))
    assert.equal(dir.includes(`${path.sep}public${path.sep}`), false)
  })

  it("honours GALLERY_PRIVATE_DIR", () => {
    const dir = resolvePrivateDir({ GALLERY_PRIVATE_DIR: "/tmp/somewhere-else" })
    assert.equal(dir, "/tmp/somewhere-else")
  })
})