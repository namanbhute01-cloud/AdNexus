import React, { useEffect, useRef, useState, startTransition, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { api, assetUrl } from '../lib/api';
import { createAdNexusSocket } from '../lib/socket';

type SessionScreen = {
  id: string;
  screenId: string;
  name: string;
  evLocation: string;
  uniqueHardwareId: string;
};

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

interface ScreenViewProps {
  token: string;
  onLogout: () => void;
  initialScreen?: SessionScreen;
}

export function ScreenView({ token, onLogout, initialScreen }: ScreenViewProps) {
  const { screenId } = useParams<{ screenId: string }>();
  const [state, setState] = useState<ScreenPlaybackState | null>(null);
  const [connected, setConnected] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get('/screen/state')
      .then((response) => {
        if (mounted) {
          setState(response.data as ScreenPlaybackState);
        }
      })
      .catch(() => {
        if (mounted && initialScreen) {
          setState({
            screenId: initialScreen.id,
            screenName: initialScreen.name,
            evLocation: initialScreen.evLocation,
            status: 'offline',
            currentContentUrl: null,
            currentContentTitle: 'AdNexus Logo',
            currentContentType: null,
            activeScheduleId: null,
            seekToSeconds: 0,
            isSyncedByEV: false,
            mode: null,
            updatedAt: new Date().toISOString(),
          });
        }
      });

    const socket = createAdNexusSocket(token);

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('screen:update', (payload: ScreenPlaybackState) => {
      startTransition(() => {
        setState(payload);
      });
    });

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [initialScreen, token]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || state?.currentContentType !== 'video' || !state.currentContentUrl) {
      return;
    }
    const seekTo = Math.max(0, state.seekToSeconds ?? 0);
    const applySeek = () => {
      try {
        if (Number.isFinite(seekTo) && Math.abs(video.currentTime - seekTo) > 0.5) {
          video.currentTime = seekTo;
        }
        void video.play();
      } catch {
        // Screens are best-effort playback clients.
      }
    };

    if (video.readyState >= 1) {
      applySeek();
      return;
    }

    video.addEventListener('loadedmetadata', applySeek, { once: true });
    return () => video.removeEventListener('loadedmetadata', applySeek);
  }, [state]);

  const mediaUrl = state?.currentContentUrl ? assetUrl(state.currentContentUrl) : null;

  return (
    <main className="screen-shell">
      <div className="screen-stage">
        <div className="screen-status-row">
          <div className="brand-mark compact">AdNexus</div>
          <span className={connected ? 'status-chip online' : 'status-chip offline'}>
            {connected ? 'Live sync' : 'Reconnecting'}
          </span>
        </div>
        <div className="screen-display">
          {mediaUrl && state?.currentContentType === 'video' ? (
            <video
              key={state.activeScheduleId ?? mediaUrl}
              ref={videoRef}
              className="screen-media"
              src={mediaUrl}
              autoPlay
              muted
              playsInline
            />
          ) : mediaUrl ? (
            <img className="screen-media" src={mediaUrl} alt={state?.currentContentTitle ?? 'AdNexus content'} />
          ) : (
            <div className="logo-halo">
              <div className="screen-logo">LOGO</div>
              <p>Waiting for a synchronized schedule.</p>
            </div>
          )}
        </div>
        <div className="screen-foot">
          <div>
            <div className="screen-name">{state?.screenName ?? initialScreen?.name ?? screenId ?? 'Screen'}</div>
            <div className="muted-line">{state?.evLocation ?? initialScreen?.evLocation ?? 'EV location pending'}</div>
          </div>
          <div className="screen-meta">
            <span>{state?.currentContentTitle ?? 'Idle'}</span>
            <span>{state?.currentContentType ?? 'logo'}</span>
            <span>{state?.status ?? 'offline'}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
