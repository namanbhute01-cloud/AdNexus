import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  MAX_CAPTION_LENGTH,
  MAX_NAME_LENGTH,
  sanitizeCaption,
  sanitizeName,
  sanitizeSlug,
  sanitizeText,
} from "@/lib/gallery/sanitize"
import { getClientIp, hashIp } from "@/lib/gallery/client-ip"
import {
  checkRateLimit,
  countInWindow,
  resetRateLimits,
} from "@/lib/gallery/rate-limit"
import { TOKEN_TTL_MS, signToken, verifyToken } from "@/lib/gallery/upload-token"

// Read lazily by requireGalleryEnv(), so setting these before the first `it()`
// body runs is enough — no import-order race.


describe("upload tokens", () => {
  it("round-trips a valid token", () => {
    const token = signToken("navaratri-2026")
    const result = verifyToken(token, "navaratri-2026")
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.payload.slug, "navaratri-2026")
      assert.equal(result.payload.jti.length > 0, true)
    }
  })

  it("rejects a tampered payload", () => {
    const token = signToken("navaratri-2026")
    const dot = token.lastIndexOf(".")
    const forgedBody = Buffer.from(
      JSON.stringify({ slug: "navaratri-2026", iat: Math.floor(Date.now() / 1000), jti: "x" }),
    ).toString("base64url")
    const result = verifyToken(`${forgedBody}${token.slice(dot)}`, "navaratri-2026")
    assert.deepEqual(result, { ok: false, reason: "BAD_SIGNATURE" })
  })

  it("rejects a tampered signature", () => {
    const token = signToken("navaratri-2026")
    const dot = token.lastIndexOf(".")
    const flipped = token.slice(dot + 1).replace(/^./, (c) => (c === "a" ? "b" : "a"))
    const result = verifyToken(`${token.slice(0, dot)}.${flipped}`, "navaratri-2026")
    assert.deepEqual(result, { ok: false, reason: "BAD_SIGNATURE" })
  })

  it("rejects a token minted for a different event", () => {
    const token = signToken("some-other-event")
    assert.deepEqual(verifyToken(token, "navaratri-2026"), { ok: false, reason: "WRONG_SLUG" })
  })

  it("rejects an expired token", () => {
    const past = Date.now() - TOKEN_TTL_MS - 60_000
    const token = signToken("navaratri-2026", past)
    assert.deepEqual(verifyToken(token, "navaratri-2026"), { ok: false, reason: "EXPIRED" })
  })

  it("rejects a token minted far in the future", () => {
    const token = signToken("navaratri-2026", Date.now() + 10 * 60_000)
    assert.deepEqual(verifyToken(token, "navaratri-2026"), { ok: false, reason: "EXPIRED" })
  })

  it("still accepts a token just inside the TTL", () => {
    const token = signToken("navaratri-2026", Date.now() - TOKEN_TTL_MS + 60_000)
    assert.equal(verifyToken(token, "navaratri-2026").ok, true)
  })

  it("rejects malformed input", () => {
    for (const bad of [null, undefined, "", "no-dot", ".onlysig", "!!!.???"]) {
      assert.equal(verifyToken(bad, "navaratri-2026").ok, false)
    }
  })

  it("rejects garbage that decodes to valid JSON of the wrong shape", () => {
    const body = Buffer.from(JSON.stringify({ nope: 1 })).toString("base64url")
    assert.deepEqual(verifyToken(`${body}.sig`, "navaratri-2026"), { ok: false, reason: "MALFORMED" })
  })

  it("issues a unique jti per token", () => {
    const a = signToken("navaratri-2026")
    const b = signToken("navaratri-2026")
    assert.notEqual(a, b)
  })
})

describe("rate limiting", () => {
  it("allows exactly `limit` hits then blocks", () => {
    resetRateLimits()
    const rule = { limit: 3, windowMs: 60_000 }
    const t = 1_000_000

    assert.equal(checkRateLimit("k", rule, t).allowed, true)
    assert.equal(checkRateLimit("k", rule, t).allowed, true)
    const third = checkRateLimit("k", rule, t)
    assert.equal(third.allowed, true)
    assert.equal(third.remaining, 0)

    const fourth = checkRateLimit("k", rule, t)
    assert.equal(fourth.allowed, false)
    assert.equal(fourth.retryAfter > 0, true)
  })

  it("reports a useful Retry-After", () => {
    resetRateLimits()
    const rule = { limit: 1, windowMs: 10_000 }
    const t = 2_000_000
    checkRateLimit("k", rule, t)
    const blocked = checkRateLimit("k", rule, t + 3_000)
    assert.equal(blocked.retryAfter, 7)
  })

  it("frees the slot once the window slides past", () => {
    resetRateLimits()
    const rule = { limit: 1, windowMs: 10_000 }
    const t = 3_000_000
    checkRateLimit("k", rule, t)
    assert.equal(checkRateLimit("k", rule, t + 9_999).allowed, false)
    assert.equal(checkRateLimit("k", rule, t + 10_001).allowed, true)
  })

  it("keeps keys independent", () => {
    resetRateLimits()
    const rule = { limit: 1, windowMs: 60_000 }
    const t = 4_000_000
    checkRateLimit("phone-a", rule, t)
    assert.equal(checkRateLimit("phone-a", rule, t).allowed, false)
    assert.equal(checkRateLimit("phone-b", rule, t).allowed, true)
  })

  it("counts without consuming", () => {
    resetRateLimits()
    const rule = { limit: 5, windowMs: 60_000 }
    const t = 5_000_000
    checkRateLimit("k", rule, t)
    checkRateLimit("k", rule, t)
    assert.equal(countInWindow("k", rule, t), 2)
    assert.equal(countInWindow("k", rule, t), 2)
    assert.equal(countInWindow("other", rule, t), 0)
  })
})

describe("client IP resolution", () => {
  const req = (headers: Record<string, string>) => new Request("https://x/", { headers })

  it("ignores cf-connecting-ip unless TRUST_CF_HEADER is true", () => {
    const r = req({ "cf-connecting-ip": "1.2.3.4" })

    assert.equal(
      getClientIp(r, {}),
      "unknown",
      "a spoofable header must not be trusted by default",
    )
    assert.equal(
      getClientIp(r, { TRUST_CF_HEADER: "false" }),
      "unknown",
    )
    assert.equal(
      getClientIp(r, { TRUST_CF_HEADER: "true" }),
      "1.2.3.4",
    )
  })

  it("takes the first x-forwarded-for hop", () => {
    const r = req({ "x-forwarded-for": "9.9.9.9, 10.0.0.1, 10.0.0.2" })
    assert.equal(getClientIp(r, {}), "9.9.9.9")
  })

  it("falls back to x-real-ip then 'unknown'", () => {
    assert.equal(getClientIp(req({ "x-real-ip": "5.5.5.5" }), {}), "5.5.5.5")
    assert.equal(getClientIp(req({}), {}), "unknown")
  })
})

describe("ip hashing", () => {
  it("is stable, short and salt-dependent", () => {
    const a = hashIp("1.2.3.4", "salt-one")
    const b = hashIp("1.2.3.4", "salt-one")
    const c = hashIp("1.2.3.4", "salt-two")
    const d = hashIp("1.2.3.5", "salt-one")

    assert.equal(a, b)
    assert.equal(a.length, 16)
    assert.notEqual(a, c)
    assert.notEqual(a, d)
    assert.equal(a.includes("1.2.3.4"), false, "the raw IP must not be recoverable from the hash")
  })
})

describe("text sanitisation", () => {
  const ZWSP = "\u200B"
  const RLO = "\u202E"
  const PDF = "\u202C"
  const BOM = "\uFEFF"
  const NUL = "\u0000"
  const BEL = "\u0007"

  it("strips control characters", () => {
    assert.equal(sanitizeText(`a${NUL}b${BEL}c`, 50), "abc")
    assert.equal(sanitizeText("line\nbreak", 50), "line break")
    assert.equal(sanitizeText("tab\there", 50), "tab here")
  })

  it("strips zero-width and bidi characters used to disguise text", () => {
    assert.equal(sanitizeText(`A${ZWSP}dmin`, 50), "Admin")
    assert.equal(sanitizeText(`admin${RLO}evil${PDF}`, 50), "adminevil")
    assert.equal(sanitizeText(`${BOM}name`, 50), "name")
  })

  it("collapses whitespace and trims", () => {
    assert.equal(sanitizeText("  hello   world  ", 50), "hello world")
    assert.equal(sanitizeText("a\r\n\r\nb", 50), "a b")
  })

  it("returns null for empty or non-string input", () => {
    for (const value of ["", "   ", "\n\t", null, undefined, 42, {}, []]) {
      assert.equal(sanitizeText(value as unknown, 50), null)
    }
  })

  it("enforces length caps by code point", () => {
    const capped = sanitizeName("\u{1F600}".repeat(200))
    assert.equal(Array.from(capped ?? "").length, MAX_NAME_LENGTH)

    const caption = sanitizeCaption("a".repeat(500))
    assert.equal(caption?.length, MAX_CAPTION_LENGTH)
  })

  it("does not split a surrogate pair at the cap", () => {
    // 60 emoji is 120 code units; capping at 60 must not leave a lone surrogate.
    const capped = sanitizeName("\u{1F600}".repeat(MAX_NAME_LENGTH))
    assert.equal(capped?.includes("\uFFFD"), false)
    assert.equal(Array.from(capped ?? "").length, MAX_NAME_LENGTH)
  })
})

describe("slug sanitisation", () => {
  it("normalises to lowercase hyphenated form", () => {
    assert.equal(sanitizeSlug("Navaratri 2026"), "navaratri-2026")
    assert.equal(sanitizeSlug("  Navaratri   2026  "), "navaratri-2026")
    assert.equal(sanitizeSlug("Diwali!! Gala"), "diwali-gala")
  })

  it("rejects slugs that normalise to nothing", () => {
    for (const value of ["", "!!!", "---", "   ", null, undefined]) {
      assert.equal(sanitizeSlug(value as unknown), null)
    }
  })

  it("never emits leading, trailing or doubled hyphens", () => {
    const slug = sanitizeSlug("--a--b--")!
    assert.equal(slug, "a-b")
    assert.equal(/^-+|-+$/.test(slug), false)
    assert.equal(slug.includes("--"), false)
  })
})