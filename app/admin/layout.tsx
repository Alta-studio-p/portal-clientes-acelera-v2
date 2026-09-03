import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

const NAV_ITEMS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/calendar", label: "Calendario" },
  { href: "/admin/clients", label: "Clientes" },
  { href: "/admin/coaches", label: "Coaches" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile, email } = await requireRole(["admin"]);

  return (
    <AppShell
      navItems={NAV_ITEMS}
      roleLabel="Admin"
      userName={profile.full_name || email}
      userEmail={email}
      searchAction="/admin/clients"
    >
      {children}
    </AppShell>
  );
}
