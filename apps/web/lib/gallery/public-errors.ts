import { NextResponse } from "next/server"

/**
 * Uniform failure shape for the public ingestion endpoints.
 *
 * INSTRUCTIONS hard rule 10: never expose internal messages or stack traces to
 * an anonymous caller. Every failure is a short machine-readable CODE that the
 * public page maps to a friendly message.
 */

export type PublicErrorCode =
  | "NOT_FOUND"
  | "EVENT_CLOSED"
  | "BAD_TOKEN"
  | "RATE_LIMITED"
  | "INTAKE_FULL"
  | "TOO_LARGE"
  | "BAD_TYPE"
  | "BAD_IMAGE"
  | "TOO_LARGE_PIXELS"
  | "TIMEOUT"
  | "BUSY"
  | "BAD_REQUEST"
  | "SERVER_ERROR"

const STATUS_BY_CODE: Record<PublicErrorCode, number> = {
  NOT_FOUND: 404,
  EVENT_CLOSED: 403,
  BAD_TOKEN: 401,
  RATE_LIMITED: 429,
  INTAKE_FULL: 503,
  TOO_LARGE: 413,
  BAD_TYPE: 415,
  BAD_IMAGE: 422,
  TOO_LARGE_PIXELS: 422,
  TIMEOUT: 503,
  BUSY: 503,
  BAD_REQUEST: 400,
  SERVER_ERROR: 500,
}

/** Codes worth logging loudly rather than silently dropping. */
const STATUS_BY_CODE_NEEDS_RETRY = new Set<PublicErrorCode>(["INTAKE_FULL", "BUSY", "TIMEOUT"])

export function publicError(code: PublicErrorCode, retryAfterSeconds?: number) {
  const status = STATUS_BY_CODE[code]

  const headers: Record<string, string> = { "Cache-Control": "no-store" }
  if (code === "RATE_LIMITED") {
    headers["Retry-After"] = String(Math.max(1, Math.ceil(retryAfterSeconds ?? 60)))
  }
  if (STATUS_BY_CODE_NEEDS_RETRY.has(code)) {
    headers["Retry-After"] = String(Math.max(1, Math.ceil(retryAfterSeconds ?? 10)))
  }

  return NextResponse.json({ error: code }, { status, headers })
}

export function statusForCode(code: PublicErrorCode): number {
  return STATUS_BY_CODE[code]
}