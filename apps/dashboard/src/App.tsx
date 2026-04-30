import type { ReactNode } from 'react';
import { FormEvent, useEffect, useRef, useState, startTransition } from 'react';
import { api, assetUrl, setAuthToken } from './lib/api';
import { createAdNexusSocket } from './lib/socket';

type Role = 'admin' | 'campaigner' | 'screen';

type Session = {
  token: string;
  role: Role;
  user: {
    id: string;
    username: string;
    role: Role;
  };
  screen?: {
    id: string;
    screenId: string;
    name: string;
    evLocation: string;
    uniqueHardwareId: string;
  };
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

type UserRow = {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
};

type ScreenRow = {
  id: string;
  screenId: string;
  name: string;
  evLocation: string;
  uniqueHardwareId: string;
  currentContentUrl: string | null;
  currentContentTitle: string | null;
  currentContentType: 'image' | 'video' | null;
  status: 'online' | 'offline';
  currentSeekSeconds: number;
  currentScheduleId: string | null;
  lastSeenAt: string | null;
  username: string | null;
};

type ContentRow = {
  id: string;
  title: string;
  fileUrl: string;
  type: 'image' | 'video';
  ownerId: string;
  createdAt: string;
};

type ScheduleRow = {
  id: string;
  contentId: string;
  startTime: string;
  endTime: string;
  screenIds: string[];
  evLocation: string;
  isSyncedByEV: boolean;
  mode: 'Continuous' | 'Single';
  createdById: string | null;
  createdAt: string;
};

const roleLabels: Record<Role, string> = {
  admin: 'Admin Controller',
  campaigner: 'Campaigner Viewer',
  screen: 'Screen Display',
};

const roleOrder: Role[] = ['admin', 'campaigner', 'screen'];

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loginRole, setLoginRole] = useState<Role>('admin');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem('adnexus.token');
    const role = window.localStorage.getItem('adnexus.role') as Role | null;
    if (!token || !role) {
      setLoadingSession(false);
      return;
    }

    setAuthToken(token);
    api
      .get('/auth/me')
      .then((response) => {
        const user = response.data as Session['user'];
        startTransition(() => {
          setSession({ token, role, user });
        });
      })
      .catch(() => {
        window.localStorage.removeItem('adnexus.token');
        window.localStorage.removeItem('adnexus.role');
        setAuthToken(null);
      })
      .finally(() => setLoadingSession(false));
  }, []);

  const handleLogin = async (username: string, password: string) => {
    setError(null);
    try {
      const endpoint = loginRole === 'screen' ? '/screen/login' : '/auth/login';
      const response = await api.post(endpoint, { username, password });
      const token = response.data.token as string;
      const user = response.data.user as Session['user'];
      const screen = response.data.screen as Session['screen'] | undefined;
      const nextSession: Session = {
        token,
        role: user.role,
        user,
        screen,
      };
      window.localStorage.setItem('adnexus.token', token);
      window.localStorage.setItem('adnexus.role', user.role);
      setAuthToken(token);
      setSession(nextSession);
    } catch (loginError) {
      setError('Login failed. Check credentials and try again.');
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('adnexus.token');
    window.localStorage.removeItem('adnexus.role');
    setAuthToken(null);
    setSession(null);
    setLoginRole('admin');
  };

  if (loadingSession) {
    return (
      <div className="boot-screen">
        <div className="boot-panel">
          <div className="brand-mark">AdNexus</div>
          <p>Restoring authenticated session.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        role={loginRole}
        error={error}
        onRoleChange={setLoginRole}
        onLogin={handleLogin}
      />
    );
  }

  if (session.role === 'screen') {
    return <ScreenPortal token={session.token} onLogout={handleLogout} initialScreen={session.screen} />;
  }

  if (session.role === 'campaigner') {
    return <CampaignerPortal token={session.token} onLogout={handleLogout} />;
  }

  return <AdminPortal session={session} onLogout={handleLogout} />;
}

function LoginScreen({
  role,
  error,
  onRoleChange,
  onLogin,
}: {
  role: Role;
  error: string | null;
  onRoleChange: (role: Role) => void;
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onLogin(username, password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <section className="login-card">
        <div className="brand-mark">AdNexus</div>
        <p className="eyebrow">Smart Content Manager</p>
        <h1>{roleLabels[role]}</h1>
        <p className="login-copy">
          Authenticate as the controller, viewer, or screen display. The screen interface stays locked down after login.
        </p>
        <div className="role-switcher">
          {roleOrder.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === role ? 'role-pill active' : 'role-pill'}
              onClick={() => onRoleChange(candidate)}
            >
              {roleLabels[candidate]}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="login-form">
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              type="password"
            />
          </label>
          {error ? <div className="error-banner">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : `Enter ${roleLabels[role]}`}
          </button>
        </form>
      </section>
    </main>
  );
}

function ScreenPortal({
  token,
  initialScreen,
}: {
  token: string;
  onLogout: () => void;
  initialScreen?: Session['screen'];
}) {
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
            <div className="screen-name">{state?.screenName ?? initialScreen?.name ?? 'Screen'}</div>
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

function CampaignerPortal({ token, onLogout }: { token: string; onLogout: () => void }) {
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

function AdminPortal({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [screens, setScreens] = useState<ScreenRow[]>([]);
  const [content, setContent] = useState<ContentRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loginRole, setLoginRole] = useState<Role>('admin');

  const refresh = async () => {
    const [usersRes, screensRes, contentRes, schedulesRes] = await Promise.all([
      api.get('/admin/users'),
      api.get('/admin/screens'),
      api.get('/admin/content'),
      api.get('/admin/schedule'),
    ]);
    setUsers(usersRes.data as UserRow[]);
    setScreens(screensRes.data as ScreenRow[]);
    setContent(contentRes.data as ContentRow[]);
    setSchedules(schedulesRes.data as ScheduleRow[]);
  };

  useEffect(() => {
    void refresh();
    const socket = createAdNexusSocket(session.token);
    socket.on('admin:refresh', () => {
      void refresh();
    });
    return () => {
      socket.disconnect();
    };
  }, [session.token]);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      username: String(form.get('username') ?? ''),
      password: String(form.get('password') ?? ''),
      role: String(form.get('role') ?? 'campaigner'),
    };
    const screenName = String(form.get('screenName') ?? '');
    const evLocation = String(form.get('evLocation') ?? '');
    const uniqueHardwareId = String(form.get('uniqueHardwareId') ?? '');
    const screenId = String(form.get('screenId') ?? '');
    if (screenName) payload.screenName = screenName;
    if (evLocation) payload.evLocation = evLocation;
    if (uniqueHardwareId) payload.uniqueHardwareId = uniqueHardwareId;
    if (screenId) payload.screenId = screenId;

    await api.post('/admin/users', payload);
    setMessage('User created');
    event.currentTarget.reset();
    await refresh();
  };

  const uploadContent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File)) {
      setMessage('Select a file first');
      return;
    }

    const payload = new FormData();
    payload.append('file', file);
    payload.append('title', String(form.get('title') ?? 'Untitled'));
    payload.append('type', String(form.get('type') ?? 'image'));
    payload.append('ownerId', String(form.get('ownerId') ?? session.user.id));

    setUploading(true);
    try {
      await api.post('/admin/content', payload);
      setMessage('Content uploaded');
      event.currentTarget.reset();
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const createSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const screenIds = form.getAll('screenIds').map((value) => String(value));
    await api.post('/admin/schedule', {
      contentId: String(form.get('contentId') ?? ''),
      startTime: new Date(String(form.get('startTime') ?? '')).toISOString(),
      endTime: new Date(String(form.get('endTime') ?? '')).toISOString(),
      screenIds,
      evLocation: String(form.get('evLocation') ?? '') || undefined,
      isSyncedByEV: form.get('isSyncedByEV') === 'on',
      mode: String(form.get('mode') ?? 'Continuous'),
    });
    setMessage('Schedule created');
    await refresh();
  };

  const updateScreen = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get('screenId') ?? '');
    await api.patch(`/admin/screens/${id}`, {
      name: String(form.get('name') ?? ''),
      evLocation: String(form.get('evLocation') ?? ''),
      uniqueHardwareId: String(form.get('uniqueHardwareId') ?? ''),
    });
    setMessage('Screen updated');
    await refresh();
  };

  return (
    <PortalFrame
      title="Admin Control Room"
      subtitle="Upload content, assign screens, and schedule synchronized EV playback."
      onLogout={onLogout}
    >
      <div className="toolbar-row">
        <span className="status-chip online">{roleLabels[session.role]}</span>
        <span className="muted-line">{users.length} users • {screens.length} screens • {content.length} assets</span>
      </div>
      {message ? <div className="notice-banner">{message}</div> : null}

      <div className="panel-grid">
        <section className="panel">
          <h3>Create User</h3>
          <form className="panel-form" onSubmit={createUser}>
            <input name="username" placeholder="username" />
            <input name="password" placeholder="password" type="password" />
            <select name="role" value={loginRole} onChange={(event) => setLoginRole(event.target.value as Role)}>
              <option value="admin">admin</option>
              <option value="campaigner">campaigner</option>
              <option value="screen">screen</option>
            </select>
            {loginRole === 'screen' ? (
              <>
                <input name="screenName" placeholder="Screen name" />
                <input name="evLocation" placeholder="EV location" />
                <input name="uniqueHardwareId" placeholder="Hardware ID" />
                <input name="screenId" placeholder="Screen ID" />
              </>
            ) : null}
            <button className="primary-button" type="submit">Create</button>
          </form>
        </section>

        <section className="panel">
          <h3>Upload Content</h3>
          <form className="panel-form" onSubmit={uploadContent}>
            <input name="title" placeholder="Campaign title" />
            <select name="type" defaultValue="image">
              <option value="image">image</option>
              <option value="video">video</option>
            </select>
            <select name="ownerId" defaultValue={session.user.id}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} ({user.role})
                </option>
              ))}
            </select>
            <input name="file" type="file" accept="image/*,video/*" />
            <button className="primary-button" type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </form>
        </section>

        <section className="panel">
          <h3>Update Screen</h3>
          <form className="panel-form" onSubmit={updateScreen}>
            <select name="screenId" defaultValue={screens[0]?.id ?? ''}>
              {screens.map((screen) => (
                <option key={screen.id} value={screen.id}>
                  {screen.name} · {screen.evLocation}
                </option>
              ))}
            </select>
            <input name="name" placeholder="Screen name" />
            <input name="evLocation" placeholder="EV location" />
            <input name="uniqueHardwareId" placeholder="Hardware ID" />
            <button className="primary-button" type="submit">Save</button>
          </form>
        </section>

        <section className="panel panel-wide">
          <h3>Schedule Content</h3>
          <form className="panel-form schedule-form" onSubmit={createSchedule}>
            <select name="contentId" defaultValue={content[0]?.id ?? ''}>
              {content.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.type})
                </option>
              ))}
            </select>
            <input name="startTime" type="datetime-local" />
            <input name="endTime" type="datetime-local" />
            <input name="evLocation" placeholder="EV location filter" />
            <select name="mode" defaultValue="Continuous">
              <option value="Continuous">Continuous</option>
              <option value="Single">Single</option>
            </select>
            <label className="toggle">
              <input name="isSyncedByEV" type="checkbox" />
              Sync content at EV
            </label>
            <div className="multi-list">
              {screens.map((screen) => (
                <label key={screen.id} className="multi-pill">
                  <input name="screenIds" type="checkbox" value={screen.id} defaultChecked />
                  {screen.name}
                </label>
              ))}
            </div>
            <button className="primary-button" type="submit">Create schedule</button>
          </form>
        </section>
      </div>

      <div className="table-grid">
        <section className="panel">
          <h3>Users</h3>
          <div className="mini-list">
            {users.map((user) => (
              <div key={user.id} className="mini-row">
                <span>{user.username}</span>
                <span>{user.role}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>Screens</h3>
          <div className="mini-list">
            {screens.map((screen) => (
              <div key={screen.id} className="mini-row">
                <span>{screen.name}</span>
                <span>{screen.evLocation}</span>
                <span>{screen.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>Content</h3>
          <div className="mini-list">
            {content.map((item) => (
              <div key={item.id} className="mini-row">
                <span>{item.title}</span>
                <span>{item.type}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>Schedules</h3>
          <div className="mini-list">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="mini-row">
                <span>{schedule.contentId.slice(0, 8)}</span>
                <span>{schedule.evLocation}</span>
                <span>{schedule.isSyncedByEV ? 'Synced' : schedule.mode}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PortalFrame>
  );
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

export default App;
