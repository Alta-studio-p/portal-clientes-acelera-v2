import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

const NAV_ITEMS = [{ href: "/portal", label: "Mi progreso" }];

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { profile, email } = await requireRole(["client"]);

  return (
    <AppShell
      navItems={NAV_ITEMS}
      roleLabel="Cliente"
      userName={profile.full_name || email}
      userEmail={email}
    >
      {children}
    </AppShell>
  );
}
