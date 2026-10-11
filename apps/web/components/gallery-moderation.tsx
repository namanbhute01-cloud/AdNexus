"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { QrPanel } from "./qr-panel"

type Status = "PENDING" | "APPROVED" | "REJECTED" | "REMOVED"

type Photo = {
  id: string
  eventId: string
  status: Status
  width: number
  height: number
  sizeBytes: number
  contributorName: string | null
  caption: string | null
  createdAt: string
  reviewedAt: string | null
  rejectReason: string | null
}

type Stats = {
  pending: number
  approved: number
  rejected: number
  removed: number
  isOpen: boolean
  intakeFull: boolean
}

/**
 * Two short beeps via the Web Audio API — no asset to ship, and no autoplay
 * problem because it only runs after an admin click has enabled sound.
 */
function playChime() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const now = ctx.currentTime
    for (const [index, freq] of [880, 1175].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + index * 0.14)
      gain.gain.linearRampToValueAtTime(0.16, now + index * 0.14 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.14 + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + index * 0.14)
      osc.stop(now + index * 0.14 + 0.32)
    }
    setTimeout(() => void ctx.close(), 900)
  } catch {
    /* sound is a nicety; never let it break moderation */
  }
}

/** Desktop notification, if the admin has granted permission. */
function notify(title: string, body: string) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return
    const n = new Notification(title, { body, tag: "gallery", icon: "/favicon.ico" })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* ignore */
  }
}

type Event = {
  id: string
  slug: string
  name: string
  campaignId: string
  isOpen: boolean
  maxFilesPerRequest: number
  maxFileBytes: number
  maxPending: number
  perTokenCap: number
  displaySeconds: number
}

const TABS: { status: Status; label: string }[] = [
  { status: "PENDING", label: "Pending" },
  { status: "APPROVED", label: "Approved" },
  { status: "REJECTED", label: "Rejected" },
  { status: "REMOVED", label: "Removed" },
]

function thumbSrc(id: string) {
  return `/api/admin/gallery/photos/${id}/image?v=thumb`
}
function fullSrc(id: string) {
  return `/api/admin/gallery/photos/${id}/image?v=full`
}

export function GalleryModeration({ event, publicBaseUrl }: { event: Event; publicBaseUrl: string }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [tab, setTab] = useState<Status>("PENDING")
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<Photo | null>(null)
  const [busy, setBusy] = useState(false)
  // Which tab has finished loading. Deriving `loading` from this instead of a
  // separate boolean keeps the tab-change effect free of synchronous setState.
  const [loadedTab, setLoadedTab] = useState<Status | null>(null)
  const [soundOn, setSoundOn] = useState(false)
  const notificationState =
    typeof Notification === "undefined" ? "unsupported" : Notification.permission

  // Prefetch the next images so the review grid and full-screen mode feel instant.
  const preloaded = useRef(new Set<string>())
  // Last pending count we saw. New photos are signalled by a RISE in this, so
  // the admin's own actions never trigger a notification.
  const lastPendingRef = useRef(0)
  const soundOnRef = useRef(false)


  // Fetch a page of photos. `no-store` matters: these are private files behind
  // an admin session, and a cached page would keep showing stale decisions.
  const loadPhotos = useCallback((status: Status) => {
    return fetch(
      `/api/admin/gallery/events/${event.id}/photos?status=${status}&limit=60`,
      { cache: "no-store" },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        setPhotos(data.photos ?? [])
        setLoadedTab(status)
      })
  }, [event.id])

  // 5s poll drives the badge, the tab counts and the intake-full warning.
  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`/api/admin/gallery/events/${event.id}/stats`, { cache: "no-store" })
        if (!res.ok || cancelled) return
        setStats(await res.json())
      } catch {
        /* transient network blips are not worth a toast every 5s */
      }
    }

    void poll()
    const id = setInterval(poll, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }

    /**
     * Warn the admin when the queue grows. Only on an INCREASE, and only after
     * the first reading, so opening the page on a pre-filled queue stays quiet.
     */
  }, [event.id])

  useEffect(() => {
    if (!stats) return
    const previous = lastPendingRef.current
    const grew = stats.pending - previous
    lastPendingRef.current = stats.pending
    if (previous === 0 || grew <= 0) return

    if (soundOnRef.current) playChime()
    notify(
      `${stats.pending} photo${stats.pending === 1 ? "" : "s"} waiting`,
      grew === 1 ? "1 new submission" : `${grew} new submissions`,
    )
    if (document.visibilityState === "visible") {
      toast(`📸 ${grew === 1 ? "New photo" : `${grew} new photos`} waiting for review`, {
        description: event.name,
      })
    }
  }, [stats, event.name])

  // Pending count drives the browser tab title so the admin notices new
  // submissions even when this tab is in the background.
  useEffect(() => {
    if (!stats) return
    document.title = stats.pending > 0 ? `(${stats.pending}) Gallery` : "Gallery"
  }, [stats])

  useEffect(() => {
    loadPhotos(tab)
  }, [tab, loadPhotos])

  const loading = loadedTab !== tab

  // Selection is cleared when the user switches tabs — an event handler, not an
  // effect, so React never sees a cascading render.
  function selectTab(next: Status) {
    setTab(next)
    setSelected(new Set())
  }

  // Warm the browser cache for upcoming thumbnails.
  useEffect(() => {
    const next = photos.filter((p) => !preloaded.current.has(p.id)).slice(0, 6)
    for (const photo of next) {
      preloaded.current.add(photo.id)
      const img = new Image()
      img.src = thumbSrc(photo.id)
    }
  }, [photos])

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  async function act(action: "approve" | "reject" | "remove", ids: string[]) {
    if (ids.length === 0) return
    setBusy(true)
    try {
      const res =
        ids.length === 1
          ? await fetch(`/api/admin/gallery/photos/${ids[0]}/${action}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: action === "reject" ? JSON.stringify({}) : undefined,
            })
          : await fetch("/api/admin/gallery/photos/bulk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, ids }),
            })

      if (!res.ok) {
        toast.error(action === "remove" ? "Could not remove that photo." : "That action failed.")
        return
      }

      const data = await res.json().catch(() => null)
      const succeeded = ids.length === 1 ? 1 : (data?.succeeded ?? ids.length)
      const already = data?.alreadyApproved ? " (already approved)" : ""

      toast.success(
        `${succeeded} photo${succeeded === 1 ? "" : "s"} ${
          action === "approve" ? "approved" : action === "reject" ? "rejected" : "removed"
        }${already}`,
      )

      setSelected(new Set())
      setPreview(null)
      loadPhotos(tab)
    } catch {
      toast.error("Network error")
    } finally {
      setBusy(false)
    }
  }

  async function toggleOpen() {
    const next = stats ? !stats.isOpen : !event.isOpen
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/gallery/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: next }),
      })
      if (!res.ok) {
        toast.error("Could not change the submissions switch.")
        return
      }
      setStats((current) => (current ? { ...current, isOpen: next } : current))
      toast.success(next ? "Submissions resumed" : "Submissions paused")
    } catch {
      toast.error("Network error")
    } finally {
      setBusy(false)
    }
  }

  const selectedList = useMemo(() => Array.from(selected), [selected])
  const isOpen = stats?.isOpen ?? event.isOpen
  const contributeUrl = `${publicBaseUrl}/contribute/${event.slug}`

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/gallery" className="text-sm text-slate-500 hover:text-slate-800">
            ← All events
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{event.name}</h1>
          <p className="mt-1 text-sm text-slate-600">{contributeUrl}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundOnRef.current = !soundOnRef.current
              setSoundOn(soundOnRef.current)
              if (soundOnRef.current) playChime()
              toast.success(soundOnRef.current ? "Alert sound on" : "Alert sound off")
            }}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              soundOn
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-slate-200 hover:bg-slate-50"
            }`}
            title="Play a sound when new photos arrive"
          >
            {soundOn ? "🔔 Sound on" : "🔕 Sound off"}
          </button>

          <button
            type="button"
            onClick={async () => {
              if (typeof Notification === "undefined") {
                toast.error("This browser has no notification support")
                return
              }
              const result = await Notification.requestPermission()
              if (result === "granted") toast.success("Desktop notifications on")
              else toast.error("Notifications blocked in browser settings")
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            title="Get a desktop notification when photos arrive"
          >
            {notificationState === "granted" ? "🔔 Desktop on" : "🔕 Desktop off"}
          </button>

          <Link
            href={`/admin/gallery/${event.id}/review`}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Review mode
          </Link>
          <Button
            onClick={toggleOpen}
            disabled={busy}
            variant={isOpen ? "outline" : "default"}
            className={`px-5 ${isOpen ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100" : ""}`}
          >
            {isOpen ? "Pause submissions" : "Resume submissions"}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        {TABS.map(({ status, label }) => {
          const count = stats?.[status.toLowerCase() as keyof Stats] as number | undefined
          return (
            <Card
              key={status}
              className={`cursor-pointer rounded-[1.25rem] shadow-sm transition ${
                tab === status ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
              }`}
              onClick={() => selectTab(status)}
            >
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-3xl font-semibold">{count ?? "—"}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {stats?.intakeFull && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          The pending queue is full ({event.maxPending}). New uploads are being refused until you
          review some. Approve or reject photos to make room.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSelected(
                    selected.size === photos.length
                      ? new Set()
                      : new Set(photos.map((p) => p.id)),
                  )
                }
              >
                {selected.size === photos.length && photos.length > 0
                  ? "Clear selection"
                  : "Select all"}
              </Button>
              {selected.size > 0 && (
                <span className="text-sm text-slate-600">{selected.size} selected</span>
              )}
            </div>

            {selected.size > 0 && (
              <div className="flex gap-2">
                {tab === "PENDING" && (
                  <Button size="sm" disabled={busy} onClick={() => act("approve", selectedList)}>
                    Approve
                  </Button>
                )}
                {tab === "APPROVED" && (
                  <Button size="sm" disabled={busy} onClick={() => act("remove", selectedList)}>
                    Remove
                  </Button>
                )}
                {(tab === "PENDING" || tab === "REJECTED") && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => act("reject", selectedList)}
                  >
                    Reject
                  </Button>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <p className="py-16 text-center text-sm text-slate-500">Loading…</p>
          ) : photos.length === 0 ? (
            <Card className="rounded-[1.5rem] border-dashed shadow-none">
              <CardContent className="py-16 text-center text-sm text-slate-500">
                Nothing in {labelFor(tab).toLowerCase()}.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className={`group relative aspect-square overflow-hidden rounded-2xl border-2 bg-slate-100 transition ${
                    selected.has(photo.id) ? "border-slate-900" : "border-transparent"
                  }`}
                >
                  {/* Authenticated admin-only stream — the only way this image is reachable. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbSrc(photo.id)}
                    alt={photo.caption ?? "Submitted photo"}
                    className="h-full w-full cursor-zoom-in object-cover"
                    onClick={() => setPreview(photo)}
                    loading="lazy"
                  />

                  <button
                    type="button"
                    aria-label="Select photo"
                    onClick={() => toggle(photo.id)}
                    className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 text-xs font-bold transition ${
                      selected.has(photo.id)
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-white bg-black/40 text-transparent"
                    }`}
                  >
                    ✓
                  </button>

                  {(photo.contributorName || photo.caption) && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-[11px] leading-tight text-white">
                      {photo.contributorName && (
                        <p className="truncate font-medium">{photo.contributorName}</p>
                      )}
                      {photo.caption && <p className="truncate opacity-80">{photo.caption}</p>}
                    </div>
                  )}

                  {tab === "PENDING" && (
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label="Approve"
                        disabled={busy}
                        onClick={() => act("approve", [photo.id])}
                        className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        aria-label="Reject"
                        disabled={busy}
                        onClick={() => act("reject", [photo.id])}
                        className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {tab === "APPROVED" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act("remove", [photo.id])}
                      className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  )}

                  {tab === "REJECTED" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act("approve", [photo.id])}
                      className="absolute right-2 top-2 rounded-md bg-emerald-600 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    >
                      Approve anyway
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <QrPanel
          url={contributeUrl}
          eventName={event.name}
          configured={Boolean(publicBaseUrl)}
          stats={stats}
        />
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="flex items-center justify-between pb-3 text-white">
            <div className="text-sm">
              {preview.contributorName && <span className="font-medium">{preview.contributorName}</span>}
              {preview.caption && <span className="opacity-70"> — {preview.caption}</span>}
              <span className="ml-2 opacity-50">
                {preview.width}×{preview.height} · {Math.round(preview.sizeBytes / 1024)} KB
              </span>
            </div>
            <div className="flex items-center gap-2">
              {tab === "PENDING" && (
                <>
                  <button
                    disabled={busy}
                    onClick={(e) => { e.stopPropagation(); void act("approve", [preview.id]) }}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={(e) => { e.stopPropagation(); void act("reject", [preview.id]) }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium"
                  >
                    Reject
                  </button>
                </>
              )}
              {tab === "APPROVED" && (
                <button
                  disabled={busy}
                  onClick={(e) => { e.stopPropagation(); void act("remove", [preview.id]) }}
                  className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium"
                >
                  Remove from screens
                </button>
              )}
              <button
                onClick={() => setPreview(null)}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullSrc(preview.id)}
            alt={preview.caption ?? "Photo"}
            className="min-h-0 flex-1 object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

function labelFor(status: Status) {
  return TABS.find((t) => t.status === status)?.label ?? status
}