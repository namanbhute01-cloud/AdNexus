"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type Campaign = { id: string; name: string; status: string; mediaCount: number }
type Event = {
  id: string
  slug: string
  name: string
  campaignId: string
  isOpen: boolean
  displaySeconds: number
  maxFileBytes: number
  totalPhotos: number
  createdAt: string
}

export function GalleryConsole({
  events,
  campaigns,
  publicBaseUrl,
}: {
  events: Event[]
  campaigns: Campaign[]
  publicBaseUrl: string
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "")
  const [busy, setBusy] = useState(false)

  async function createEvent(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim() || !slug.trim() || !campaignId) return

    setBusy(true)
    try {
      const res = await fetch("/api/admin/gallery/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), campaignId }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        toast.error(
          data?.error === "SLUG_TAKEN"
            ? "That link slug is already in use."
            : data?.error === "CAMPAIGN_NOT_FOUND"
              ? "Pick an existing campaign."
              : "Could not create the event.",
        )
        return
      }

      toast.success("Event created")
      setName(""); setSlug(""); setCreating(false)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-orange-600">Gallery</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Community Gallery</h1>
        <p className="mt-2 text-sm text-slate-600">
          Students scan a QR code and submit photos without an account. Nothing reaches a screen
          until you approve it.
        </p>
      </header>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Events</h2>
        <Button onClick={() => setCreating((v) => !v)}>
          {creating ? "Cancel" : "New event"}
        </Button>
      </div>

      {creating && (
        <Card className="rounded-[1.5rem] border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle>Create an event</CardTitle>
            <CardDescription>
              The campaign is where approved photos are published. Create one in Campaigns first if
              you have not already.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createEvent} className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Display name</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Navaratri 2026"
                  required
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Link slug</span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="navaratri-2026"
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  required
                />
                <span className="text-xs text-slate-500">
                  QR link: {publicBaseUrl}/contribute/{slug || "your-slug"}
                </span>
              </label>

              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Target campaign</span>
                <select
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  required
                >
                  <option value="">Select a campaign…</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.status} ({c.mediaCount} media)
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  {busy ? "Creating…" : "Create event"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {events.length === 0 ? (
        <Card className="rounded-[1.5rem] border-dashed shadow-none">
          <CardContent className="py-12 text-center text-sm text-slate-500">
            No events yet. Create one to get a QR code.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {events.map((event) => (
            <Link key={event.id} href={`/admin/gallery/${event.id}`} className="block">
              <Card className="h-full rounded-[1.5rem] border-slate-200/80 shadow-sm transition hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-xl">{event.name}</CardTitle>
                      <p className="mt-1 text-sm text-slate-500">/contribute/{event.slug}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        event.isOpen
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {event.isOpen ? "Open" : "Paused"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Photos</p>
                    <p className="mt-1 text-xl font-semibold">{event.totalPhotos}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">On screen</p>
                    <p className="mt-1 text-xl font-semibold">{event.displaySeconds}s</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Max size</p>
                    <p className="mt-1 text-xl font-semibold">
                      {Math.round(event.maxFileBytes / (1024 * 1024))} MB
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}