/**
 * In-memory sliding-window rate limiter.
 *
 * Single-process by design (DECISIONS D11): the event deployment is one Node
 * instance, and a shared Redis store would be a new dependency plus new
 * infrastructure for one evening. If this app is ever scaled horizontally,
 * replace this module — callers already treat it as a single choke point.
 */

type Window = { timestamps: number[] }

const windows = new Map<string, Window>()

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  /** Seconds until the caller may retry. 0 when allowed. */
  retryAfter: number
}

export type RateLimitRule = {
  /** Max hits inside the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

const CLEANUP_INTERVAL_MS = 60_000
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanup() {
  // `unref` so a pending cleanup never keeps the process alive.
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now()
    for (const [key, window] of windows) {
      window.timestamps = window.timestamps.filter((ts) => ts > cutoff - MAX_WINDOW_MS)
      if (window.timestamps.length === 0) windows.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  cleanupTimer.unref?.()
}

const MAX_WINDOW_MS = 60 * 60 * 1000

export function checkRateLimit(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  ensureCleanup()

  const window = windows.get(key) ?? { timestamps: [] }

  // Drop everything that has aged out before counting.
  window.timestamps = window.timestamps.filter((ts) => ts > now - rule.windowMs)

  if (window.timestamps.length >= rule.limit) {
    const oldest = window.timestamps[0]
    windows.set(key, window)
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)),
    }
  }

  window.timestamps.push(now)
  windows.set(key, window)
  return { allowed: true, remaining: rule.limit - window.timestamps.length, retryAfter: 0 }
}

/** Count current hits without consuming one — used for the per-token cap. */
export function countInWindow(key: string, rule: RateLimitRule, now = Date.now()): number {
  const window = windows.get(key)
  if (!window) return 0
  return window.timestamps.filter((ts) => ts > now - rule.windowMs).length
}

/** Reserve a slot without recording a hit — for caps checked before heavy work. */
export function reserve(key: string, rule: RateLimitRule, now = Date.now()): RateLimitResult {
  const used = countInWindow(key, rule, now)
  if (used >= rule.limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil(rule.windowMs / 1000) }
  }
  return { allowed: true, remaining: rule.limit - used - 1, retryAfter: 0 }
}

export function resetRateLimits(): void {
  windows.clear()
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}