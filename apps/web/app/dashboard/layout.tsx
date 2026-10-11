import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";

export const dynamic = "force-dynamic";

const navLinks = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/dashboard/screens", label: "Screens", icon: "screens" },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: "campaigns" },
  { href: "/dashboard/media", label: "Media Vault", icon: "media" },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Only ADMIN sessions can exist now (INSTRUCTIONS T10), so any session that
  // reaches this layout belongs in the admin console. The CAMPAIGNER role and
  // its rows still exist in the database — they simply cannot sign in.
  redirect("/admin");

  return (
    <PortalShell
      appName="VAART-E"
      title="Campaigner Console"
      subtitle="Read-only portal for assigned campaigns, display status, and currently displayed content."
      userName={session?.user.name ?? "Admin"}
      userRole={session?.user.role ?? "ADMIN"}
      tone="campaigner"
      navLinks={navLinks}
    >
      {children}
    </PortalShell>
  );
}
