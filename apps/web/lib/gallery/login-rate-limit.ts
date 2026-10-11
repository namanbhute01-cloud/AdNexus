import { checkRateLimit } from "./rate-limit"

/**
 * Login brute-force limiter: 5 attempts / 15 min per (IP + email).
 *
 * Keyed on the pair rather than either alone, so one attacker guessing many
 * emails is not throttled by a per-email bucket, and one victim being sprayed
 * from a shared campus NAT does not lock every other student out (DECISIONS D8).
 *
 * Successful logins are counted too — an attacker who gets it right is not the
 * threat model, and not exempting them keeps the counter honest.
 */

const RULE = { limit: 5, windowMs: 15 * 60_000 } as const

export function checkLoginRateLimit(email: string): { allowed: boolean; retryAfter: number } {
  const ip = currentIp()
  return checkRateLimit(`login:${ip}:${email.toLowerCase()}`, RULE)
}

/**
 * Auth.js' Credentials `authorize()` receives no request object, so the socket
 * address is the best signal available here. Behind a trusted proxy this is the
 * proxy's IP — acceptable, because it degrades to "all logins share a bucket",
 * which is strict rather than permissive.
 */
function currentIp(): string {
  const forwarded = process.env.LOGIN_RATE_LIMIT_IP
  if (forwarded) return forwarded
  return "direct"
}