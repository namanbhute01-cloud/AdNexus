"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";
import {
  Film,
  Grid3X3,
  Images,
  LayoutDashboard,
  LogOut,
  Monitor,
  Radio,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type IconName =
  | "dashboard"
  | "monitor"
  | "users"
  | "campaigns"
  | "assignments"
  | "settings"
  | "media"
  | "screens"
  | "gallery";

type NavLink = {
  href: string;
  label: string;
  icon: IconName;
};

type PortalShellProps = {
  appName: string;
  title: string;
  subtitle: string;
  userName: string;
  userRole: string;
  tone: "admin" | "campaigner";
  navLinks: readonly NavLink[];
  children: ReactNode;
};

const iconMap = {
  dashboard: LayoutDashboard,
  monitor: Monitor,
  users: Users,
  campaigns: Film,
  assignments: Grid3X3,
  settings: Settings,
  media: Upload,
  screens: Radio,
  gallery: Images,
} satisfies Record<IconName, typeof LayoutDashboard>;

const toneMap = {
  admin: {
    panel: "border-white/10 bg-slate-950/80 text-white",
    glow: "from-orange-500/20 via-transparent to-cyan-400/20",
    badge: "bg-orange-500/15 text-orange-200 ring-orange-400/30",
    active: "bg-white/14 text-white shadow-[0_18px_40px_-24px_rgba(255,255,255,0.45)]",
    inactive: "text-slate-300 hover:bg-white/8 hover:text-white",
  },
  campaigner: {
    panel: "border-white/10 bg-slate-950/85 text-white",
    glow: "from-cyan-500/20 via-transparent to-orange-400/20",
    badge: "bg-cyan-500/15 text-cyan-100 ring-cyan-400/30",
    active: "bg-white/14 text-white shadow-[0_18px_40px_-24px_rgba(34,211,238,0.45)]",
    inactive: "text-slate-300 hover:bg-white/8 hover:text-white",
  },
} as const;

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalShell({
  appName,
  title,
  subtitle,
  userName,
  userRole,
  tone,
  navLinks,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const palette = toneMap[tone];

  return (
    <div className="min-h-screen px-4 py-4 md:px-6 lg:px-8">
      <div
        className={`mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 overflow-hidden rounded-[2rem] border ${palette.panel} lg:grid-cols-[280px_minmax(0,1fr)]`}
      >
        <aside className="relative overflow-hidden border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
          <div className={`absolute inset-0 bg-gradient-to-br ${palette.glow}`} />
          <div className="relative flex h-full flex-col gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{appName}</p>
              <h1 className="mt-3 text-2xl font-semibold leading-tight">{title}</h1>
              <p className="mt-2 max-w-xs text-sm text-slate-400">{subtitle}</p>
            </div>

            <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {navLinks.map((link) => {
                const Icon = iconMap[link.icon];
                const active = isCurrent(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex min-w-fit items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${active ? palette.active : palette.inactive}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${palette.badge}`}>
                {userRole}
              </span>
              <p className="mt-3 text-sm text-slate-400">Signed in as</p>
              <p className="text-base font-semibold">{userName}</p>
              <Button
                variant="outline"
                className="mt-4 w-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </aside>

        <main className="bg-white/92 p-5 text-slate-950 backdrop-blur md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
