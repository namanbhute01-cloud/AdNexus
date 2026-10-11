import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";

export const dynamic = "force-dynamic";

const navLinks = [
  { href: "/admin", label: "Overview", icon: "dashboard" },
  { href: "/admin/evs", label: "Display Units", icon: "monitor" },
  { href: "/admin/media", label: "Media Studio", icon: "media" },
  { href: "/admin/campaigns", label: "Campaigns", icon: "campaigns" },
  { href: "/admin/assignments", label: "Assignments", icon: "assignments" },
  { href: "/admin/gallery", label: "Gallery", icon: "gallery" },
  { href: "/admin/monitor", label: "Live Monitor", icon: "screens" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    // Campaigners cannot obtain a session at all (see `authorize()`), so this
    // branch is reachable only by a stale cookie. Send them to /login, not back
    // to /dashboard, which would loop.
    redirect("/login");
  }

  return (
    <PortalShell
      appName="VAART-E"
      title="Operations Control"
      subtitle="Manage display units, approve campaign inventory, assign playlists to browser screens, and monitor playback health in real time."
      userName={session.user.name ?? "Admin"}
      userRole={session.user.role}
      tone="admin"
      navLinks={navLinks}
    >
      {children}
    </PortalShell>
  );
}
