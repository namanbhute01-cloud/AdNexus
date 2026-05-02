import React, { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Monitor, Film, Calendar, BarChart2, Tv, Settings, LogOut, Zap } from 'lucide-react';

interface AppShellProps {
  onLogout: () => void;
  user: { username: string; role: string };
  children: ReactNode;
}

const NAV = [
  { label: 'Dashboard', icon: LayoutGrid, href: '/admin' },
  { label: 'Devices',   icon: Monitor,    href: '/admin/devices' },
  { label: 'Campaigns', icon: Film,        href: '/admin/campaigns' },
  { label: 'Schedule',  icon: Calendar,   href: '/admin/schedule' },
  { label: 'Analytics', icon: BarChart2,  href: '/admin/analytics' },
  { label: 'Screens',   icon: Tv,         href: '/admin/screens' },
  { label: 'Settings',  icon: Settings,   href: '/admin/settings' },
];

export function AppShell({ onLogout, user, children }: AppShellProps) {
  return (
    <div className="flex h-screen bg-base text-text-1">
      {/* Sidebar */}
      <aside className="w-[180px] bg-surface border-r border-border flex flex-col justify-between py-6">
        <div>
          <div className="brand-mark compact text-center mb-6">AdNexus</div>
          <nav>
            {NAV.map((item) => (
              <NavLink
                key={item.label}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2 text-sm font-body transition-colors
                   ${isActive
                     ? 'bg-accent/10 border-l-2 border-accent text-accent'
                     : 'text-text-3 hover:text-text-1 hover:bg-elevated'
                   }`
                }
                end={item.href === '/admin'} // Use end prop for exact matching for dashboard
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="px-4">
          <button
            className="w-full flex items-center justify-center gap-2 py-2 text-danger bg-danger/10 border border-danger rounded-md text-sm font-semibold hover:bg-danger/20 transition-colors"
          >
            <Zap size={16} />
            EMERGENCY OVERRIDE
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="h-[52px] bg-surface border-b border-border flex items-center justify-between px-6">
          <div className="text-lg font-display font-semibold">AdNexus Admin</div>
          <div className="flex items-center gap-3">
            <span className="text-text-2 text-sm">{user.username} ({user.role})</span>
            <button onClick={onLogout} className="text-text-3 hover:text-text-1 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 bg-base overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
