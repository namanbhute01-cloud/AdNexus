import Pusher from "pusher"
import { prisma } from "@vaart/database"
import { getPlaylistForCampaign } from "@/lib/campaign-playlist"

/**
 * Fan a campaign's playlist out to every TV currently assigned to it.
 *
 * ARCHITECTURE §8.2/§9 assumed a "playlist changed" notifier already existed.
 * T0 proved it does not: Pusher is constructed inline in
 * `app/api/admin/assignments/route.ts` and only fires for assignment changes,
 * on per-TV channels. This module is that notifier (DECISIONS D2).
 *
 * The channel/event names are the ones the player already binds
 * (`device-player.tsx:36,123`), so no player change is required — which keeps
 * DECISIONS D1 (adding a content poll) as the only player touch.
 */

let client: Pusher | null = null

export function hasPusherConfig(): boolean {
  return [process.env.PUSHER_APP_ID, process.env.PUSHER_KEY, process.env.PUSHER_SECRET, process.env.PUSHER_CLUSTER].every(
    (value) => value && value.trim() && value.trim() !== "dummy",
  )
}

function getPusher(): Pusher | null {
  if (!hasPusherConfig()) return null
  if (!client) {
    client = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
    })
  }
  return client
}

/**
 * Best-effort notify. Never throws: a realtime outage must not roll back an
 * approval that is already committed to the database. Screens still converge
 * via the poll added in DECISIONS D1.
 */
export async function notifyCampaignPlaylistChanged(campaignId: string): Promise<void> {
  const pusher = getPusher()
  if (!pusher) return

  try {
    const assignments = await prisma.screenAssignment.findMany({
      where: { campaignId, isActive: true },
      select: { tv: { select: { subSerial: true, ev: { select: { serialNumber: true } } } } },
    })

    if (assignments.length === 0) return

    const playlist = await getPlaylistForCampaign(campaignId)

    await Promise.all(
      assignments.map(({ tv }) =>
        pusher.trigger(
          `tv-${tv.ev.serialNumber}-${tv.subSerial}`,
          "content-update",
          { campaignId, playlist },
        ),
      ),
    )
  } catch (error) {
    console.error("[gallery] playlist notify failed (screens will catch up by polling):", error)
  }
}