"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

type Status = "PENDING" | "APPROVED" | "REJECTED" | "REMOVED"

type Photo = {
  id: string
  status: Status
  width: number
  height: number
  sizeBytes: number
  contributorName: string | null
  caption: string | null
}

/**
 * Full-screen one-at-a-time review.
 *
 * Built for the actual event situation: one person, one laptop, hundreds of
 * photos, and no desire to touch the mouse. A/R decide, Z undoes, arrows move.
 * Auto-advance only happens after a decision, so a mis-click is recoverable.
 */
export function GalleryReview({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<{ photo: Photo; action: "approve" | "reject" }[]>([])
  const [showHelp, setShowHelp] = useState(true)

  // Keep the last N full-size images decoded so arrow-key navigation is instant.
  const preloaded = useRef(new Set<string>())


  const load = useCallback(() => {
    return fetch(
      `/api/admin/gallery/events/${eventId}/photos?status=PENDING&limit=100`,
      { cache: "no-store" },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        setPhotos(data.photos ?? [])
        setIndex(0)
        setLoading(false)
      })
  }, [eventId])

  useEffect(() => {
    load()
  }, [load])

  const current = photos[index] ?? null

  const prefetch = useCallback((from: number) => {
    for (let i = from; i < Math.min(from + 3, photos.length); i += 1) {
      const photo = photos[i]
      if (!photo || preloaded.current.has(photo.id)) continue
      preloaded.current.add(photo.id)
      const img = new Image()
      img.src = `/api/admin/gallery/photos/${photo.id}/image?v=full`
    }
  }, [photos])

  useEffect(() => {
    prefetch(index)
  }, [index, prefetch])

  const decide = useCallback(
    async (action: "approve" | "reject") => {
      const photo = photos[index]
      if (!photo || busy) return
      setBusy(true)

      // Optimistic: drop it from the queue and move on immediately.
      setPhotos((list) => list.filter((p) => p.id !== photo.id))
      setHistory((h) => [...h.slice(-19), { photo, action }])
      setIndex((i) => (i >= photos.length - 1 ? 0 : i))

      try {
        const res = await fetch(`/api/admin/gallery/photos/${photo.id}/${action}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: action === "reject" ? JSON.stringify({}) : undefined,
        })

        if (!res.ok) {
          // Roll back so the photo is not silently lost.
          setPhotos((list) => [photo, ...list])
          setHistory((h) => h.slice(0, -1))
          toast.error(action === "approve" ? "Approve failed" : "Reject failed")
          return
        }

        const data = await res.json().catch(() => null)
        if (data?.alreadyApproved) toast.info("Already approved")
      } catch {
        setPhotos((list) => [photo, ...list])
        setHistory((h) => h.slice(0, -1))
        toast.error("Network error — change not saved")
      } finally {
        setBusy(false)
      }
    },
    [photos, index, busy],
  )

  const undo = useCallback(async () => {
    const last = history[history.length - 1]
    if (!last || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/gallery/photos/${last.photo.id}/${last.action === "approve" ? "reject" : "approve"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: last.action === "approve" ? JSON.stringify({ reason: "Undo" }) : undefined,
      })
      if (!res.ok) {
        toast.error("Undo failed")
        return
      }
      setHistory((h) => h.slice(0, -1))
      await load()
      toast.success("Undone")
    } catch {
      toast.error("Network error")
    } finally {
      setBusy(false)
    }
  }, [history, busy, load])

  // Hotkeys. Bound on the document so focus does not have to be managed.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return

      switch (event.key.toLowerCase()) {
        case "a":
          event.preventDefault()
          void decide("approve")
          break
        case "r":
          event.preventDefault()
          void decide("reject")
          break
        case "z":
          event.preventDefault()
          void undo()
          break
        case "arrowright":
          event.preventDefault()
          setIndex((i) => (photos.length ? (i + 1) % photos.length : 0))
          break
        case "arrowleft":
          event.preventDefault()
          setIndex((i) => (photos.length ? (i - 1 + photos.length) % photos.length : 0))
          break
        case "?":
          setShowHelp((v) => !v)
          break
        default:
          break
      }
    }

    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [decide, undo, photos.length])

  const remaining = useMemo(() => photos.length, [photos])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <Link href={`/admin/gallery/${eventId}`} className="text-sm text-slate-400 hover:text-white">
            ← Back to grid
          </Link>
          <h1 className="mt-1 text-lg font-semibold">{eventName} — review</h1>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">{remaining} left</span>
          {history.length > 0 && (
            <button onClick={undo} disabled={busy} className="rounded-lg bg-white/10 px-3 py-1.5">
              Undo <kbd className="ml-1 opacity-60">Z</kbd>
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-4">
        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : !current ? (
          <div className="text-center">
            <div className="text-5xl">🎉</div>
            <p className="mt-4 text-2xl font-semibold">Queue clear</p>
            <p className="mt-2 text-slate-400">New submissions will appear here automatically.</p>
            <button
              onClick={() => void load()}
              className="mt-6 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Check again
            </button>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.id}
              src={`/api/admin/gallery/photos/${current.id}/image?v=full`}
              alt={current.caption ?? "Submission"}
              className="min-h-0 max-h-full flex-1 object-contain"
            />

            <div className="w-full max-w-3xl text-center">
              <p className="text-sm text-slate-300">
                {current.contributorName && <span className="font-medium text-white">{current.contributorName}</span>}
                {current.contributorName && current.caption ? " — " : ""}
                {current.caption ?? "No caption"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {current.width}×{current.height} · {Math.round(current.sizeBytes / 1024)} KB ·
                position {index + 1} of {photos.length}
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => void decide("reject")}
                disabled={busy}
                className="rounded-2xl bg-red-600 px-10 py-4 text-lg font-semibold hover:bg-red-500 disabled:opacity-40"
              >
                Reject <kbd className="ml-2 text-sm opacity-70">R</kbd>
              </button>
              <button
                onClick={() => void decide("approve")}
                disabled={busy}
                className="rounded-2xl bg-emerald-600 px-10 py-4 text-lg font-semibold hover:bg-emerald-500 disabled:opacity-40"
              >
                Approve <kbd className="ml-2 text-sm opacity-70">A</kbd>
              </button>
            </div>
          </>
        )}
      </div>

      {showHelp && (
        <footer className="border-t border-white/10 px-6 py-3 text-center text-xs text-slate-500">
          <kbd>A</kbd> approve · <kbd>R</kbd> reject · <kbd>Z</kbd> undo ·{" "}
          <kbd>←</kbd> <kbd>→</kbd> navigate · <kbd>?</kbd> hide this
        </footer>
      )}
    </div>
  )
}