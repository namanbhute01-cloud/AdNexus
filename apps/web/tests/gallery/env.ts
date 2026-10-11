import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

/**
 * Test environment bootstrap.
 *
 * `node --test` runs outside the Next.js runtime, so `.env.local` is never
 * loaded and `DATABASE_URL` arrives empty. These tests need a real Postgres, so
 * we read the Prisma CLI's env file (the same one `prisma migrate deploy` uses)
 * before anything imports `@vaart/database`.
 *
 * Already-set variables always win, so CI can inject its own.
 */

function parseEnvFile(file: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

const repoRoot = path.resolve(process.cwd(), "..", "..")

for (const candidate of [
  path.join(repoRoot, "packages", "database", ".env"),
  path.join(process.cwd(), ".env.local"),
  path.join(process.cwd(), ".env"),
]) {
  if (!existsSync(candidate)) continue
  for (const [key, value] of Object.entries(parseEnvFile(candidate))) {
    if (process.env[key] === undefined) process.env[key] = value
  }
}

// Deterministic gallery secrets so token/IP hashing is reproducible in tests.
process.env.GALLERY_TOKEN_SECRET ??= "test-token-secret-".padEnd(32, "0").slice(0, 32)
process.env.GALLERY_IP_SALT ??= "test-ip-salt-".padEnd(32, "1").slice(0, 32)
process.env.PUBLIC_BASE_URL ??= "http://localhost:3000"