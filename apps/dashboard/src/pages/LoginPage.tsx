import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Role = 'admin' | 'campaigner' | 'screen';

const roleLabels: Record<Role, string> = {
  admin: 'Admin Controller',
  campaigner: 'Campaigner Viewer',
  screen: 'Screen Display',
};

const roleOrder: Role[] = ['admin', 'campaigner', 'screen'];

interface LoginPageProps {
  onLogin: (username: string, password: string, role: Role) => Promise<Role>;
  error: string | null;
}

export function LoginPage({ onLogin, error }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loginRole, setLoginRole] = useState<Role>('admin');
  const navigate = useNavigate();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const role = await onLogin(username, password, loginRole);
      if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'campaigner') {
        navigate('/campaigner');
      } else if (role === 'screen') {
        navigate('/screen/view/someScreenId'); // Needs actual screenId from login response
      }
    } catch (err) {
      // Error handled by App.tsx and passed as prop
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
        <h1>{roleLabels[loginRole]}</h1>
        <p className="login-copy">
          Authenticate as the controller, viewer, or screen display. The screen interface stays locked down after login.
        </p>
        <div className="role-switcher">
          {roleOrder.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === loginRole ? 'role-pill active' : 'role-pill'}
              onClick={() => setLoginRole(candidate)}
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
            {submitting ? 'Signing in...' : `Enter ${roleLabels[loginRole]}`}
          </button>
        </form>
      </section>
    </main>
  );
}
