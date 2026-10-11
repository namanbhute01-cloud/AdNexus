/**
 * Authz sweep (INSTRUCTIONS T7 / T10 "Done when").
 *
 * Drives a running server and asserts that EVERY /api/admin/gallery/** route
 * rejects an anonymous caller with 401. Admin routes are the only surface where
 * a missed check would expose student photos, so this is verified mechanically
 * rather than by reading the code.
 *
 *   pnpm --filter web build && pnpm --filter web start
 *   npx tsx scripts/gallery-authz-sweep.ts [baseUrl]
 */

const BASE = process.argv[2] ?? "http://localhost:3000"

type Case = { method: string; path: string; body?: unknown }

/**
 * The gallery routes must return a precise 401 with no session
 * (`requireAdmin()`), so they are asserted strictly. The pre-existing CMS
 * routes use the older `role !== "ADMIN" -> 403` pattern; they are still
 * correctly closed to anonymous callers, and INSTRUCTIONS rule 11 says not to
 * rewrite unrelated code — so for those the property under test is simply
 * "anonymous is rejected", not the specific status.
 */
const GALLERY_CASES: Case[] = [
  { method: "GET", path: "/api/admin/gallery/events" },
  { method: "POST", path: "/api/admin/gallery/events", body: { name: "x", slug: "x", campaignId: "x" } },
  { method: "PATCH", path: "/api/admin/gallery/events/does-not-exist", body: { isOpen: true } },
  { method: "GET", path: "/api/admin/gallery/events/does-not-exist/stats" },
  { method: "GET", path: "/api/admin/gallery/events/does-not-exist/photos" },
  { method: "GET", path: "/api/admin/gallery/photos/does-not-exist/image" },
  { method: "POST", path: "/api/admin/gallery/photos/does-not-exist/approve" },
  { method: "POST", path: "/api/admin/gallery/photos/does-not-exist/reject", body: {} },
  { method: "POST", path: "/api/admin/gallery/photos/does-not-exist/remove" },
  { method: "POST", path: "/api/admin/gallery/photos/bulk", body: { action: "approve", ids: ["x"] } },
]

const CMS_CASES: Case[] = [
  { method: "GET", path: "/api/campaigns" },
  { method: "POST", path: "/api/campaigns", body: { name: "x" } },
  { method: "GET", path: "/api/media" },
  { method: "POST", path: "/api/media", body: {} },
  { method: "DELETE", path: "/api/media", body: { id: "x" } },
  { method: "POST", path: "/api/media/upload-url", body: {} },
  { method: "PUT", path: "/api/media/local-upload?key=uploads/x/y.jpg" },
  { method: "GET", path: "/api/admin/assignments" },
  { method: "GET", path: "/api/admin/settings" },
  { method: "PATCH", path: "/api/admin/settings", body: {} },
  { method: "POST", path: "/api/admin/display-units", body: {} },
]

/** Routes that are intentionally reachable without a session. */
const PUBLIC: Case[] = [
  { method: "GET", path: "/api/health" },
  { method: "GET", path: "/api/display/content" }, // device headers only
  { method: "POST", path: "/api/display/heartbeat" }, // device headers only
]

async function call(testCase: Case) {
  return fetch(`${BASE}${testCase.path}`, {
    method: testCase.method,
    headers: { "Content-Type": "application/json" },
    body: testCase.body === undefined ? undefined : JSON.stringify(testCase.body),
    redirect: "manual",
  })
}

async function main() {
  console.log(`Authz sweep against ${BASE}\n`)
  let failures = 0

  console.log("  -- gallery routes: anonymous must get exactly 401 --")
  for (const testCase of GALLERY_CASES) {
    const res = await call(testCase)
    const ok = res.status === 401
    if (!ok) failures += 1
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${testCase.method.padEnd(6)} ${testCase.path.padEnd(52)} -> ${res.status} (want 401)`,
    )
  }

  console.log("\n  -- pre-existing CMS routes: anonymous must be rejected (401 or 403) --")
  for (const testCase of CMS_CASES) {
    const res = await call(testCase)
    const ok = res.status === 401 || res.status === 403
    if (!ok) failures += 1
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${testCase.method.padEnd(6)} ${testCase.path.padEnd(52)} -> ${res.status} (want 401|403)`,
    )
  }

  console.log("\n  -- intentionally public --")
  for (const testCase of PUBLIC) {
    const res = await call(testCase)
    const ok = res.status !== 401 && res.status !== 403
    if (!ok) failures += 1
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${testCase.method.padEnd(6)} ${testCase.path.padEnd(52)} -> ${res.status} (public)`,
    )
  }

  console.log(failures === 0 ? "\nAUTHZ SWEEP PASSED" : `\nAUTHZ SWEEP FAILED (${failures})`)
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch((error) => {
  console.error("sweep could not run:", error)
  process.exitCode = 1
})