import React, { FormEvent, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

type Role = 'admin' | 'campaigner' | 'screen';

interface ScreenLoginProps {
  onLogin: (username: string, password: string, role: Role) => Promise<Role>;
  error: string | null;
}

export function ScreenLogin({ onLogin, error }: ScreenLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const screenName = searchParams.get('screen') ?? 'Unknown Screen';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const role = await onLogin(username, password, 'screen');
      if (role === 'screen') {
        // Assuming successful screen login redirects to /screen/view/{screen_id}
        // The actual screen_id should come from the login response
        navigate(`/screen/view/\${screenName}`); // Placeholder, replace with actual screenId
      }
    } catch (err) {
      // Error handled by App.tsx and passed as prop
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="w-full h-screen flex items-center justify-center bg-base text-text-1">
      <section className="max-w-sm w-full p-8 rounded-2xl bg-surface border border-border flex flex-col items-center animate-fade-in">
        {/* AdNexus Logo SVG/IMG */}
        <div className="mb-8">
          {/* Replace with actual SVG or img tag for AdNexus logo */}
          <img src="/path/to/adnexus-logo.svg" alt="AdNexus Logo" className="h-16" />
        </div>

        {/* Screen Name Badge */}
        <div className="mb-6 px-4 py-2 rounded-full border border-accent text-accent font-mono text-sm">
          {screenName}
        </div>

        <div className="w-full border-b border-border-light mb-8"></div>

        <form onSubmit={submit} className="w-full space-y-4">
          {/* Username Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-3 font-mono uppercase tracking-wider text-left">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter screen username (e.g., EV-0042-A)"
              className="bg-surface border border-border rounded-lg px-3 py-2 text-text-1 text-sm font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 placeholder:text-text-4 transition-all duration-150"
              autoComplete="username"
            />
          </div>

          {/* Password Field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-3 font-mono uppercase tracking-wider text-left">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 pr-10 text-text-1 text-sm font-mono focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 placeholder:text-text-4 transition-all duration-150"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-3 hover:text-text-1 focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && <p className="text-danger text-sm mt-2 animate-shake-x">{error}</p>}

          {/* Login Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent text-base font-display font-bold py-2 rounded-lg hover:bg-accent/90 transition-colors duration-150"
          >
            {submitting ? 'LOGGING IN...' : 'LOGIN'}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-text-3 text-xs text-center space-y-1">
          <p>Powered by AdNexus</p>
          <p className="text-text-4">&copy; Smart Content Manager</p>
        </div>
      </section>
    </main>
  );
}
