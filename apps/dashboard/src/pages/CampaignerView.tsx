import React, { useState, useEffect, startTransition, ReactNode } from 'react';
import { api, assetUrl } from '../lib/api';
import { createAdNexusSocket } from '../lib/socket';

type ScreenPlaybackState = {
  screenId: string;
  screenName: string;
  evLocation: string;
  status: 'online' | 'offline';
  currentContentUrl: string | null;
  currentContentTitle: string | null;
  currentContentType: 'image' | 'video' | null;
  activeScheduleId: string | null;
  seekToSeconds: number;
  isSyncedByEV: boolean;
  mode: 'Continuous' | 'Single' | null;
  updatedAt: string;
};

interface CampaignerPortalProps {
  token: string;
  onLogout: () => void;
}

function PortalFrame({
  title,
  subtitle,
  onLogout,
  children,
}: {
  title: string;
  subtitle: string;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <main className="portal-shell">
      <div className="portal-glow portal-glow-a" />
      <div className="portal-glow portal-glow-b" />
      <header className="portal-header">
        <div>
          <div className="brand-mark compact">AdNexus</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button className="secondary-button" type="button" onClick={onLogout}>
          Logout
        </button>
      </header>
      <section className="portal-content">{children}</section>
    </main>
  );
}

export function CampaignerView({ token, onLogout }: CampaignerPortalProps) {
  const [screens, setScreens] = useState<ScreenPlaybackState[]>([]);
  const [connection, setConnection] = useState<'live' | 'syncing'>('syncing');

  useEffect(() => {
    let mounted = true;
    api
      .get('/campaigner/screens')
      .then((response) => {
        if (mounted) {
          setScreens(response.data as ScreenPlaybackState[]);
        }
      })
      .catch(() => {
        if (mounted) {
          setScreens([]);
        }
      });

    const socket = createAdNexusSocket(token);

    socket.on('connect', () => setConnection('live'));
    socket.on('campaigner:screens', (payload: { screens?: ScreenPlaybackState[] } | ScreenPlaybackState[]) => {
      const next = Array.isArray(payload) ? payload : payload.screens ?? [];
      startTransition(() => {
        setScreens(next);
      });
    });
    socket.on('campaigner:screens:refresh', (payload: { screenId: string; state?: ScreenPlaybackState }) => {
      if (!payload?.screenId) {
        return;
      }
      startTransition(() => {
        setScreens((current) =>
          current.map((screen) =>
            screen.screenId === payload.screenId ? { ...screen, ...(payload.state ?? {}) } : screen,
          ),
        );
      });
    });

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [token]);

  return (
    <PortalFrame title="Campaigner Live Grid" subtitle="View-only feed mirrored from every active screen." onLogout={onLogout}>
      <div className="toolbar-row">
        <span className={connection === 'live' ? 'status-chip online' : 'status-chip syncing'}>
          {connection === 'live' ? 'Realtime connected' : 'Syncing feed'}
        </span>
        <span className="muted-line">{screens.length} screens tracked</span>
      </div>
      <div className="screen-grid">
        {screens.map((screen) => (
          <article key={screen.screenId} className="screen-card">
            <div className="screen-card-header">
              <div>
                <h3>{screen.screenName}</h3>
                <p>{screen.evLocation}</p>
              </div>
              <span className={screen.status === 'online' ? 'status-chip online' : 'status-chip offline'}>
                {screen.status}
              </span>
            </div>
            <div className="screen-preview">
              {screen.currentContentUrl ? (
                screen.currentContentType === 'video' ? (
                  <video
                    key={`${screen.screenId}:${screen.activeScheduleId ?? 'idle'}`}
                    className="preview-media"
                    src={assetUrl(screen.currentContentUrl)}
                    autoPlay
                    muted
                    playsInline
                    loop
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      if (Number.isFinite(screen.seekToSeconds)) {
                        video.currentTime = Math.max(0, screen.seekToSeconds);
                      }
                    }}
                  />
                ) : (
                  <img className="preview-media" src={assetUrl(screen.currentContentUrl)} alt={screen.currentContentTitle ?? screen.screenName} />
                )
              ) : (
                <div className="logo-halo compact">
                  <div className="screen-logo">LOGO</div>
                </div>
              )}
            </div>
            <div className="screen-card-footer">
              <span>{screen.currentContentTitle ?? 'Idle'}</span>
              <span>{screen.mode ?? 'No schedule'}</span>
            </div>
          </article>
        ))}
      </div>
    </PortalFrame>
  );
}
