"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Stats = {
  pending: number
  approved: number
  rejected: number
  removed: number
  isOpen: boolean
  intakeFull: boolean
}

/**
 * The printed artefact of the whole system. Printing quality matters more than
 * usual here: these codes get stuck to walls and photographed from a metre away,
 * often in bad light, so error correction is set to H (recoverable from ~30%
 * damage) with a generous quiet zone.
 */
export function QrPanel({
  url,
  eventName,
  configured,
  stats,
}: {
  url: string
  eventName: string
  configured: boolean
  stats: Stats | null
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [svg, setSvg] = useState<string>("")

  useEffect(() => {
    if (!configured || !canvasRef.current) return
    let cancelled = false

    const options = {
      errorCorrectionLevel: "H" as const,
      margin: 4,
      width: 320,
      color: { dark: "#0f172a", light: "#ffffff" },
    }

    QRCode.toCanvas(canvasRef.current, url, options).catch(() => undefined)
    QRCode.toString(url, { ...options, type: "svg" })
      .then((result) => {
        if (!cancelled) setSvg(result)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [url, configured])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied")
    } catch {
      toast.error("Could not copy — select the text instead")
    }
  }

  function download(kind: "png" | "svg") {
    try {
      if (kind === "svg" && svg) {
        const blob = new Blob([svg], { type: "image/svg+xml" })
        triggerDownload(blob, `${eventName.replace(/\s+/g, "-").toLowerCase()}-qr.svg`)
        return
      }
      const canvas = canvasRef.current
      if (!canvas) return
      // 1024px for print; the 320px preview is too soft on a large sheet.
      const hi = document.createElement("canvas")
      hi.width = 1024
      hi.height = 1024
      const ctx = hi.getContext("2d")
      if (!ctx) return
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, 1024, 1024)
      ctx.drawImage(canvas, 0, 0, 1024, 1024)
      hi.toBlob((blob) => {
        if (blob) triggerDownload(blob, `${eventName.replace(/\s+/g, "-").toLowerCase()}-qr.png`)
      }, "image/png")
    } catch {
      toast.error("Could not build the download")
    }
  }

  return (
    <Card className="h-fit rounded-[1.5rem] border-slate-200/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">QR code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!configured ? (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            Set <code>PUBLIC_BASE_URL</code> to the address students&apos; phones can reach, then
            restart. The QR code cannot be generated without it.
          </p>
        ) : (
          <>
            <div className="flex justify-center rounded-2xl bg-white p-3">
              <canvas ref={canvasRef} className="h-auto w-full max-w-64" />
            </div>

            <p className="break-all rounded-xl bg-slate-50 p-2 text-center text-xs text-slate-600">
              {url}
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={copy}
                className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-medium hover:bg-slate-50"
              >
                Copy
              </button>
              <button
                onClick={() => download("png")}
                className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-medium hover:bg-slate-50"
              >
                PNG
              </button>
              <button
                onClick={() => download("svg")}
                className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-medium hover:bg-slate-50"
              >
                SVG
              </button>
            </div>

            {stats && (
              <dl className="space-y-1 border-t border-slate-100 pt-3 text-xs">
                <Row label="Submissions" value={stats.isOpen ? "Open" : "Paused"} good={stats.isOpen} />
                <Row label="Pending" value={String(stats.pending)} />
                <Row label="Approved" value={String(stats.approved)} />
                <Row label="Rejected" value={String(stats.rejected)} />
              </dl>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={good ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>{value}</dd>
    </div>
  )
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}