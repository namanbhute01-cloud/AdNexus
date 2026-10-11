"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Public upload client.
 *
 * Hard constraint from ARCHITECTURE §7.1: this must work in in-app browsers
 * (Instagram, WhatsApp, campus Wi-Fi captive portals), so it never touches
 * cookies or localStorage. The upload token is held in a React ref for the life
 * of the page and sent as a header.
 *
 * Photos are downscaled in the browser before upload. A 12 MB phone photo
 * becomes ~1 MB, which matters on mobile data and sidesteps the 10 MB cap.
 */

const FRIENDLY: Record<string, string> = {
  NOT_FOUND: "This event link is not valid.",
  EVENT_CLOSED: "Submissions are closed right now.",
  BAD_TOKEN: "Your session expired. Please reopen the QR code and try again.",
  RATE_LIMITED: "Too many uploads from this device. Please wait a minute.",
  INTAKE_FULL: "We have as many photos as we can review. Please try again later.",
  TOO_LARGE: "That photo is too large. Please pick a smaller one.",
  BAD_TYPE: "That file is not a photo. Please choose a JPEG, PNG or WebP image.",
  BAD_IMAGE: "We could not read that photo. Please try a different one.",
  TOO_LARGE_PIXELS: "That photo is too large to process. Please pick a smaller one.",
  TIMEOUT: "That photo took too long to process. Please try again.",
  BUSY: "A lot of people are uploading right now. Please try again in a moment.",
  BAD_REQUEST: "Something went wrong with that upload.",
  SERVER_ERROR: "Something went wrong on our side. Please try again.",
  NETWORK: "No connection. Check your network and try again.",
}

const MAX_CLIENT_EDGE = 2560
const CLIENT_QUALITY = 0.85
const MAX_CONCURRENT_UPLOADS = 2
const MAX_ATTEMPTS = 3

type SessionState =
  | { status: "loading" }
  | { status: "closed" }
  | { status: "error"; message: string }
  | { status: "ready"; token: string; maxFiles: number; maxFileBytes: number }

type QueuedPhoto = {
  id: string
  previewUrl: string
  file: Blob
  name: string
  progress: number
  state: "queued" | "uploading" | "done" | "error"
  error?: string
  attempts: number
}

function friendlyMessage(code: string, fallback = "Upload failed."): string {
  return FRIENDLY[code] ?? fallback
}

/**
 * Downscale in the browser via canvas.
 *
 * `imageOrientation: 'from-image'` applies the EXIF rotation so portrait photos
 * taken on a phone are not uploaded sideways. On any failure (HEIC on older
 * Safari, an exotic codec) we fall back to the original bytes and let the server
 * decide — the server pipeline is the real gate.
 */
async function downscaleForUpload(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function") return file

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    try {
      bitmap = await createImageBitmap(file)
    } catch {
      return file
    }
  }

  try {
    const scale = Math.min(1, MAX_CLIENT_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 400_000) return file

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext("2d")
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CLIENT_QUALITY),
    )
    return blob && blob.size > 0 ? blob : file
  } catch {
    return file
  } finally {
    bitmap.close?.()
  }
}

type Props = {
  slug: string
  name: string
  open: boolean
}

export function ContributeClient({ slug, name, open }: Props) {
  const [session, setSession] = useState<SessionState>(
    open ? { status: "loading" } : { status: "closed" },
  )
  const [photos, setPhotos] = useState<QueuedPhoto[]>([])
  const [name_, setName] = useState("")
  const [caption, setCaption] = useState("")
  const [consent, setConsent] = useState(false)
  const [honeypot, setHoneypot] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const tokenRef = useRef<string | null>(null)
  const [inFlight, setInFlight] = useState(0)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const controller = new AbortController()

    async function load() {
      try {
        const res = await fetch(`/api/contribute/${slug}/session`, {
          cache: "no-store",
          signal: controller.signal,
        })
        if (cancelled) return

        const data = await res.json().catch(() => null)

        if (!res.ok) {
          setSession({ status: "error", message: friendlyMessage(data?.error ?? "SERVER_ERROR") })
          return
        }

        if (!data?.open) {
          setSession({ status: "closed" })
          return
        }

        tokenRef.current = data.token
        setSession({
          status: "ready",
          token: data.token,
          maxFiles: data.limits?.maxFiles ?? 5,
          maxFileBytes: data.limits?.maxFileBytes ?? 10 * 1024 * 1024,
        })
      } catch (error) {
        if (cancelled || (error as Error).name === "AbortError") return
        setSession({ status: "error", message: friendlyMessage("NETWORK") })
      }
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [slug, open])

  const update = useCallback((id: string, patch: Partial<QueuedPhoto>) => {
    setPhotos((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const onFilesSelected = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || session.status !== "ready") return

      const room = Math.max(0, session.maxFiles - photos.length)
      const chosen = Array.from(fileList).slice(0, room)

      for (const file of chosen) {
        const blob = await downscaleForUpload(file)
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        setPhotos((current) => [
          ...current,
          {
            id,
            previewUrl: URL.createObjectURL(blob),
            file: blob,
            name: file.name,
            progress: 0,
            state: "queued",
            attempts: 0,
          },
        ])
      }
    },
    [photos.length, session],
  )

  /** One photo, one request. Uses XHR purely for upload progress events. */
  const sendOne = useCallback(
    (photo: QueuedPhoto, token: string, attempt: number): Promise<{ ok: boolean; code?: string }> =>
      new Promise((resolve) => {
        const form = new FormData()
        form.append("file", photo.file, "gallery.jpg")
        form.append("consent", "true")
        if (name_) form.append("name", name_)
        if (caption) form.append("caption", caption)
        if (honeypot) form.append("hp", honeypot)

        const xhr = new XMLHttpRequest()
        xhr.open("POST", `/api/contribute/${slug}/photos`)
        xhr.setRequestHeader("X-Gallery-Token", token)
        xhr.setRequestHeader("Accept", "application/json")

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return
          update(photo.id, { progress: Math.round((event.loaded / event.total) * 100) })
        }

        xhr.onload = () => {
          let code: string | undefined
          try {
            code = JSON.parse(xhr.responseText)?.error
          } catch {
            code = undefined
          }
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, code })
        }
        xhr.onerror = () => resolve({ ok: false, code: "NETWORK" })
        xhr.ontimeout = () => resolve({ ok: false, code: "NETWORK" })
        xhr.timeout = 60_000

        update(photo.id, { state: "uploading", progress: 0, attempts: attempt, error: undefined })
        xhr.send(form)
      }),
    [caption, honeypot, name_, slug, update],
  )

  const uploadAll = useCallback(async () => {
    if (session.status !== "ready" || busy) return

    const pending = photos.filter((p) => p.state === "queued" || p.state === "error")
    if (pending.length === 0) return

    setBusy(true)
    const token = tokenRef.current ?? session.token

    // Bounded concurrency: two at a time keeps phones on slow links happy and
    // stops the event server's sharp queue from saturating.
    const queue = [...pending]
    let fatal: string | null = null

    const worker = async () => {
      while (queue.length > 0 && fatal === null) {
        const photo = queue.shift()
        if (!photo) return

        setInFlight((count) => count + 1)
        let result: { ok: boolean; code?: string } = { ok: false }

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
          result = await sendOne(photo, token, attempt)

          if (result.ok) {
            update(photo.id, { state: "done", progress: 100, error: undefined })
            break
          }

          const retryable =
            result.code === "NETWORK" || result.code === "BUSY" || result.code === "TIMEOUT" ||
            result.code === "SERVER_ERROR" || result.code === "RATE_LIMITED"

          if (!retryable || attempt === MAX_ATTEMPTS) {
            update(photo.id, { state: "error", error: friendlyMessage(result.code ?? "SERVER_ERROR") })
            break
          }

          // Exponential backoff: 1s, 2s, 4s.
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)))
        }

        // Stop the whole batch on the conditions that cannot improve by retrying.
        if (!result.ok && ["EVENT_CLOSED", "INTAKE_FULL", "BAD_TOKEN", "NOT_FOUND"].includes(result.code ?? "")) {
          fatal = result.code as string
        }

        setInFlight((count) => count - 1)
      }
    }

    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_UPLOADS, queue.length) }, worker))

    setBusy(false)

    if (fatal) {
      setSession((current) =>
        current.status === "ready"
          ? { status: "error", message: friendlyMessage(fatal as string) }
          : current,
      )
      return
    }

    if (photos.every((p) => p.state === "done" || p.state === "error")) {
      // Only claim success when nothing errored.
      setPhotos((current) => {
        setDone(current.every((p) => p.state === "done"))
        return current
      })
    }
  }, [busy, photos, sendOne, session, update])

  const removePhoto = useCallback((id: string) => {
    setPhotos((current) => {
      const target = current.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((p) => p.id !== id)
    })
  }, [])

  const hasErrors = photos.some((p) => p.state === "error")
  const pendingCount = photos.filter((p) => p.state === "queued" || p.state === "error").length

  // ---------------------------------------------------------------- states
  if (session.status === "loading") {
    return <Shell name={name}><Centered>Loading…</Centered></Shell>
  }

  if (session.status === "closed") {
    return (
      <Shell name={name}>
        <Centered>
          <h1 className="text-2xl font-semibold">Submissions are closed</h1>
          <p className="mt-3 text-slate-600">
            Thanks for your interest — photo uploads for {name} are no longer being accepted.
          </p>
        </Centered>
      </Shell>
    )
  }

  if (session.status === "error") {
    return (
      <Shell name={name}>
        <Centered>
          <h1 className="text-2xl font-semibold">Can&apos;t take photos right now</h1>
          <p className="mt-3 text-slate-600">{session.message}</p>
        </Centered>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell name={name}>
        <Centered>
          <div className="text-5xl" aria-hidden="true">🎉</div>
          <h1 className="mt-4 text-2xl font-semibold">Sent for review — thanks!</h1>
          <p className="mt-3 text-slate-600">
            Your {photos.length === 1 ? "photo is" : "photos are"} with the team. Once they approve
            {photos.length === 1 ? " it" : " them"}, {photos.length === 1 ? "it" : "they"} will appear on the
            campus screens.
          </p>
          <p className="mt-6 text-sm text-slate-500">You can close this page.</p>
        </Centered>
      </Shell>
    )
  }

  return (
    <Shell name={name}>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Share your {name} photos</h1>
          <p className="mt-2 text-sm text-slate-600">
            No account, no app. Pick photos below and send them to the screens.
          </p>
        </header>

        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-6 text-center transition active:scale-[0.99]">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(event) => {
              void onFilesSelected(event.target.files)
              event.target.value = ""
            }}
          />
          <span className="text-lg font-medium">Choose photos</span>
          <span className="text-xs text-slate-500">
            JPEG, PNG or WebP · up to {Math.round(session.maxFileBytes / (1024 * 1024))} MB each ·
            {" "}{session.maxFiles} at a time
          </span>
        </label>

        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <li key={photo.id} className="relative aspect-square overflow-hidden rounded-2xl bg-slate-200">
                {/* Local blob preview of a photo the server has not accepted yet. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.previewUrl} alt={photo.name} className="h-full w-full object-cover" />

                {photo.state === "uploading" && (
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/30">
                    <div className="h-full bg-emerald-400 transition-all" style={{ width: `${photo.progress}%` }} />
                  </div>
                )}

                {photo.state === "done" && (
                  <span className="absolute right-1 top-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">
                    Sent
                  </span>
                )}

                {photo.state === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 p-2 text-center">
                    <span className="text-xs text-white">{photo.error}</span>
                    <button
                      type="button"
                      className="rounded-full bg-white/20 px-2 py-1 text-xs text-white"
                      onClick={() => update(photo.id, { state: "queued", error: undefined })}
                    >
                      Retry
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  aria-label={`Remove ${photo.name}`}
                  className="absolute left-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white"
                  onClick={() => removePhoto(photo.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 rounded-3xl bg-white p-4">
          <label className="block">
            <span className="text-sm font-medium">Your name (optional)</span>
            <input
              value={name_}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Aisha"
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Caption (optional)</span>
            <input
              value={caption}
              maxLength={140}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="e.g. Garba night!"
              className="mt-1 w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
            />
          </label>

          {/* Honeypot — hidden from people, irresistible to bots. */}
          <div className="hidden" aria-hidden="true">
            <label>
              Leave this field empty
              <input value={honeypot} onChange={(event) => setHoneypot(event.target.value)} tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span className="text-sm text-slate-700">
              My photos may be displayed on campus screens after review. I understand the organisers can
              remove any photo at any time.
            </span>
          </label>
        </div>

        <button
          type="button"
          disabled={!consent || busy || pendingCount === 0}
          onClick={() => void uploadAll()}
          className="w-full rounded-3xl bg-slate-950 px-6 py-4 text-lg font-medium text-white disabled:opacity-40"
        >
          {busy
            ? `Sending… (${inFlight} uploading)`
            : hasErrors
              ? "Retry failed photos"
              : `Send ${pendingCount || ""} photo${pendingCount === 1 ? "" : "s"}`}
        </button>

        {!consent && photos.length > 0 && (
          <p className="text-center text-sm text-slate-500">Please tick the box above to send your photos.</p>
        )}
      </div>
    </Shell>
  )
}

function Shell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-lg">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-slate-400">{name}</p>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">{children}</div>
}