"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Pusher from "pusher-js";

type PlaylistItem = {
  id: string;
  url: string;
  type: "VIDEO" | "IMAGE" | "AUDIO";
  order: number;
  duration: number | null;
  playbackLayer: "PRIMARY" | "AMBIENT";
  volumePercent: number;
  duckAmbient: boolean;
  loopPlayback: boolean;
  originalName: string;
};

const DUCKED_AMBIENT_VOLUME = 0.2;

/**
 * How often to re-fetch the playlist when Pusher is not pushing.
 *
 * T0 (docs/gallery/AUDIT.md, finding F1) proved the player previously fetched
 * the playlist exactly once on mount, so an approved Community Gallery photo
 * would never reach a screen unless Pusher happened to be configured. Polling
 * is the fallback floor; when Pusher is configured the push still arrives
 * first and this just re-syncs. See DECISIONS D1.
 */
const CONTENT_POLL_MS = 15_000;

/** Events that count as a real user gesture for autoplay unlock. */
const POINTER_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

export function DevicePlayer() {
  const params = useSearchParams();
  const serial = params.get("serial");
  const subSerial = params.get("sub");
  const apiBase = params.get("api") || "";
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [status, setStatus] = useState("Waiting for device credentials");
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const ambientMediaRef = useRef<HTMLMediaElement | null>(null);
  const primaryMediaRef = useRef<HTMLMediaElement | null>(null);
  const [audioUnlockNeeded, setAudioUnlockNeeded] = useState(false);
  const lastPlaylistRef = useRef<string | null>(null);
  const unmuteArmed = useRef<Set<HTMLMediaElement>>(new Set());

  const channelName = useMemo(
    () => (serial && subSerial ? `tv-${serial}-${subSerial}` : null),
    [serial, subSerial],
  );

  const baseUrl = apiBase || (typeof window !== "undefined" ? window.location.origin : "");

  const currentAmbient =
    useMemo(
      () => playlist.filter((item) => item.playbackLayer === "AMBIENT").sort((a, b) => a.order - b.order)[0] ?? null,
      [playlist],
    );

  const primaryItems = useMemo(
    () => playlist.filter((item) => item.playbackLayer === "PRIMARY").sort((a, b) => a.order - b.order),
    [playlist],
  );

  const currentPrimary = primaryItems.length ? primaryItems[primaryIndex % primaryItems.length] : null;

  /**
   * Does this item actually need audio? An IMAGE never does, so the unlock
   * gate must never cover one — that was the bug in AUDIT F12.
   */
  const needsAudio = (item: PlaylistItem | null) =>
    Boolean(item && item.type !== "IMAGE" && item.volumePercent > 0);

  const audioGateVisible =
    audioUnlockNeeded && (needsAudio(currentPrimary) || needsAudio(currentAmbient));
  const hasAudioMedia = useMemo(
    () => playlist.some((item) => item.type === "AUDIO" || item.type === "VIDEO"),
    [playlist],
  );

  useEffect(() => {
    if (!serial || !subSerial) return;
    const serialValue = serial;
    const subSerialValue = subSerial;

    let cancelled = false;

    async function fetchContent() {
      try {
        const response = await fetch(`${baseUrl}/api/display/content`, {
          headers: {
            "X-Serial": serialValue,
            "X-SubSerial": subSerialValue,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          setStatus("Unauthorized or not assigned");
          return;
        }

        const data = await response.json();
        if (cancelled) return;

        const next: PlaylistItem[] = data.playlist ?? [];

        // Only reset playback when the playlist actually changed. Without this
        // guard the poll would restart the current image every 15 seconds.
        const fingerprint = next.map((item) => item.id).join(",");
        if (fingerprint !== lastPlaylistRef.current) {
          lastPlaylistRef.current = fingerprint;
          setPlaylist(next);
          setPrimaryIndex(0);
        }

        setStatus((current) =>
          current.startsWith("Connected") || current.startsWith("Live")
            ? current
            : `Connected · ${subSerialValue}`,
        );
      } catch {
        if (!cancelled) setStatus("Connection failed");
      }
    }

    fetchContent();

    // DECISIONS D1 — this is the change T0 proved necessary.
    const poll = setInterval(fetchContent, CONTENT_POLL_MS);

    // A TV that was asleep/asleep-tab should catch up immediately on wake.
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchContent();
    };
    document.addEventListener("visibilitychange", onVisible);

    const heartbeat = setInterval(() => {
      fetch(`${baseUrl}/api/display/heartbeat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Serial": serialValue,
          "X-SubSerial": subSerialValue,
        },
        body: JSON.stringify({ timestamp: Date.now() }),
      }).catch(() => undefined);
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [baseUrl, serial, subSerial]);

  useEffect(() => {
    if (!channelName) return;

    const key = (process.env.NEXT_PUBLIC_PUSHER_KEY || "").trim();
    const cluster = (process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1").trim();

    if (!key) {
      return;
    }

    const pusher = new Pusher(key, { cluster });
    const channel = pusher.subscribe(channelName);

    channel.bind("content-update", (data: { playlist: PlaylistItem[] }) => {
      const next = data.playlist ?? [];
      lastPlaylistRef.current = next.map((item) => item.id).join(",");
      setPlaylist(next);
      setPrimaryIndex(0);
      setStatus(`Live update · ${subSerial}`);
    });

    channel.bind("clear-content", () => {
      lastPlaylistRef.current = "";
      setPlaylist([]);
      setPrimaryIndex(0);
      setStatus("Playlist cleared");
    });

    pusher.connection.bind("connected", () => setStatus(`Realtime online · ${subSerial}`));
    pusher.connection.bind("disconnected", () => setStatus("Realtime reconnecting"));

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [channelName, subSerial]);

  function advancePrimary() {
    setPrimaryIndex((index) => (primaryItems.length ? (index + 1) % primaryItems.length : 0));
  }

  function applyAmbientVolume(item: PlaylistItem | null, ducked: boolean) {
    const element = ambientMediaRef.current;
    if (!element || !item) return;
    const baseVolume = Math.max(0, Math.min(1, item.volumePercent / 100));
    element.volume = ducked ? baseVolume * DUCKED_AMBIENT_VOLUME : baseVolume;
  }

  /**
   * Try to start media, degrading to MUTED rather than giving up.
   *
   * Browsers block autoplay with sound until the user interacts with the page.
   * The old behaviour treated that as a hard failure and raised a full-screen
   * "Tap to start playback with audio" gate — which sat ON TOP of the gallery
   * photos, so an event screen showed a blocking overlay instead of student
   * pictures (AUDIT F12).
   *
   * Now: play muted, keep playing, and quietly restore sound on the first
   * genuine user gesture. A display screen must never be blocked by an audio
   * policy it cannot click through.
   */
  async function tryStartMedia(
    element: HTMLMediaElement | null,
    kind: "ambient" | "primary",
  ) {
    if (!element) return;
    try {
      await element.play();
      if (!element.muted && element.volume > 0) setAudioUnlockNeeded(false);
      return;
    } catch {
      // Blocked with sound. Retry muted so the video still plays.
      try {
        element.muted = true;
        await element.play();
        setAudioUnlockNeeded(false);
        armUnmuteOnGesture(element);
      } catch {
        // Even muted playback failed (no data / bad URL) — nothing to show.
        if (kind === "ambient" || element.volume > 0) {
          setAudioUnlockNeeded(true);
          setStatus("Playback blocked");
        }
      }
    }
  }

  /** Restore sound the first time a real user gesture happens. */
  function armUnmuteOnGesture(element: HTMLMediaElement) {
    if (unmuteArmed.current.has(element)) return;
    unmuteArmed.current.add(element);

    const restore = async () => {
      element.muted = false;
      try {
        await element.play();
        setAudioUnlockNeeded(false);
      } catch {
        element.muted = true;
      }
    };

    for (const event of POINTER_EVENTS) {
      window.addEventListener(event, restore, { once: true, passive: true });
    }
  }

  useEffect(() => {
    if (!currentAmbient) return;
    applyAmbientVolume(currentAmbient, false);
  }, [currentAmbient]);

  useEffect(() => {
    if (!currentPrimary || !currentAmbient) return;
    const shouldDuck =
      currentPrimary.duckAmbient &&
      (currentPrimary.type === "VIDEO" || currentPrimary.type === "AUDIO");
    applyAmbientVolume(currentAmbient, shouldDuck);
    return () => applyAmbientVolume(currentAmbient, false);
  }, [currentAmbient, currentPrimary]);

  /**
   * One start attempt per item change, not per render. `tryStartMedia` is a
   * fresh closure each render, so it is deliberately not a dependency — adding
   * it would restart playback on every keystroke-sized state change.
   */
  const ambientId = currentAmbient?.id;
  const primaryId = currentPrimary?.id;
  useEffect(() => {
    void tryStartMedia(ambientMediaRef.current, "ambient");
  }, [ambientId]);
  useEffect(() => {
    void tryStartMedia(primaryMediaRef.current, "primary");
  }, [primaryId]);

  if (!serial || !subSerial) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-8 text-white">
        <div className="max-w-2xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Universal player</p>
          <h1 className="mt-4 text-4xl font-semibold">Open on any browser device.</h1>
          <p className="mt-4 text-sm text-slate-300">
            TVs, projectors, tablets, phones, kiosks, mini PCs. Use query string:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-black/50 p-4 text-sm text-orange-200">
{`/player?serial=NRT-EV-001&sub=NRT-EV-001-TV1`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white">
      {currentAmbient?.type === "VIDEO" ? (
        <video
          key={currentAmbient.id}
          ref={(element) => {
            ambientMediaRef.current = element;
            if (element) {
              element.volume = currentAmbient.volumePercent / 100;
              element.muted = false;
            }
          }}
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          src={currentAmbient.url}
          autoPlay
          loop
          muted={false}
          playsInline
        />
      ) : null}

      {currentAmbient?.type === "AUDIO" ? (
        <audio
          key={currentAmbient.id}
          ref={(element) => {
            ambientMediaRef.current = element;
            if (element) {
              element.volume = currentAmbient.volumePercent / 100;
            }
          }}
          src={currentAmbient.url}
          autoPlay
          loop
          preload="auto"
        />
      ) : null}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_28%)]" />

      <div className="relative z-10 flex h-full w-full items-center justify-center">
        {!currentPrimary ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/5 px-8 py-6 text-center backdrop-blur">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Idle</p>
            <h2 className="mt-3 text-3xl font-semibold">No primary content assigned</h2>
          </div>
        ) : currentPrimary.type === "VIDEO" ? (
          <video
            key={currentPrimary.id}
            className="h-full w-full object-cover"
            src={currentPrimary.url}
            autoPlay
            loop={currentPrimary.loopPlayback}
            playsInline
            ref={(element) => {
              primaryMediaRef.current = element;
              if (element) {
                element.volume = currentPrimary.volumePercent / 100;
                element.muted = false;
              }
            }}
            onEnded={advancePrimary}
            onError={advancePrimary}
          />
        ) : currentPrimary.type === "AUDIO" ? (
          <audio
            key={currentPrimary.id}
            src={currentPrimary.url}
            autoPlay
            loop={currentPrimary.loopPlayback}
            ref={(element) => {
              primaryMediaRef.current = element;
              if (element) {
                element.volume = currentPrimary.volumePercent / 100;
              }
            }}
            preload="auto"
            onEnded={advancePrimary}
            onError={advancePrimary}
          />
        ) : (
          <ImageFrame item={currentPrimary} onDone={advancePrimary} />
        )}
      </div>

      {audioGateVisible ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm">
          <button
            type="button"
            className="rounded-[2rem] border border-white/20 bg-white/10 px-8 py-5 text-center text-white shadow-2xl"
            onClick={async () => {
              await Promise.allSettled([
                tryStartMedia(ambientMediaRef.current, "ambient"),
                tryStartMedia(primaryMediaRef.current, "primary"),
              ]);
            }}
          >
            <span className="block text-xs uppercase tracking-[0.35em] text-slate-300">
              Audio required
            </span>
            <span className="mt-3 block text-2xl font-semibold">Start playback with audio</span>
            <span className="mt-2 block text-sm text-slate-300">
              This browser blocked sound. Tap once to enable it.
            </span>
          </button>
        </div>
      ) : null}

      {!audioGateVisible && hasAudioMedia ? (
        <button
          type="button"
          className="absolute left-4 top-4 z-20 rounded-full border border-white/20 bg-black/55 px-4 py-2 text-xs tracking-[0.2em] text-white backdrop-blur"
          onClick={async () => {
            await Promise.allSettled([
              tryStartMedia(ambientMediaRef.current, "ambient"),
              tryStartMedia(primaryMediaRef.current, "primary"),
            ]);
          }}
        >
          Restart audio
        </button>
      ) : null}

      <div className="absolute bottom-4 right-4 z-20 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs tracking-[0.2em] text-slate-200 backdrop-blur">
        {status}
      </div>
    </div>
  );
}

function ImageFrame({
  item,
  onDone,
}: {
  item: PlaylistItem;
  onDone: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, (item.duration || 10) * 1000);
    return () => window.clearTimeout(timer);
  }, [item.duration, onDone]);

  return (
    <Image
      key={item.id}
      src={item.url}
      alt={item.originalName}
      fill
      unoptimized
      className="object-cover"
      onError={onDone}
    />
  );
}
