import { useEffect, useState, startTransition } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { api, setAuthToken } from './lib/api';
import { RoleGuard } from './components/RoleGuard';
import { LoginPage } from './pages/LoginPage';
import { ScreenLogin } from './pages/ScreenLogin';
import { ScreenView } from './pages/ScreenView'; // Assuming this component will be created
import { CampaignerView } from './pages/CampaignerView';
import { AdminShell } from './pages/AdminShell';

type Role = 'admin' | 'campaigner' | 'screen';

interface Session {
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
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
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
        const user = response.data.user as Session['user'];
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

  const handleLogin = async (username: string, password: string, loginRole: Role) => {
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
      return user.role; // Return the role for navigation
    } catch (loginError) {
      setError('Login failed. Check credentials and try again.');
      throw loginError; // Re-throw to be caught by the component using handleLogin
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('adnexus.token');
    window.localStorage.removeItem('adnexus.role');
    setAuthToken(null);
    setSession(null);
    // navigate('/login'); // This would be handled by the router
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

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage onLogin={handleLogin} error={error} />} />
        <Route path="/screen/login" element={<ScreenLogin onLogin={handleLogin} error={error} />} />

        {/* Screen Role Routes */}
        <Route
          path="/screen/view/:screenId"
          element={
            <RoleGuard role="screen">
              <ScreenView token={session?.token as string} onLogout={handleLogout} initialScreen={session?.screen} />
            </RoleGuard>
          }
        />

        {/* Campaigner Role Routes */}
        <Route
          path="/campaigner"
          element={
            <RoleGuard role={['campaigner', 'admin']}>
              <CampaignerView token={session?.token as string} onLogout={handleLogout} />
            </RoleGuard>
          }
        />

        {/* Admin Role Routes */}
        <Route
          path="/admin/*"
          element={
            <RoleGuard role="admin">
              <AdminShell session={session as Session} onLogout={handleLogout} />
            </RoleGuard>
          }
        />

        {/* Default redirect if no session or unknown route */}
        <Route path="*" element={<Navigate to={session ? (session.role === 'admin' ? '/admin' : '/campaigner') : '/login'} replace />} />
      </Routes>
    </Router>
  );
}

export default App;
