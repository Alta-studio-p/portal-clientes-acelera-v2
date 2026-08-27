import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCoachByProfileId } from "@/lib/data/client-detail";
import { AppShell } from "@/components/app-shell";

const NAV_ITEMS = [{ href: "/coach", label: "Mis clientes" }];

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const { profile, email, userId } = await requireRole(["coach"]);

  const coach = await getCoachByProfileId(userId);
  if (!coach) redirect("/login?error=no_profile");

  return (
    <AppShell
      navItems={NAV_ITEMS}
      roleLabel="Coach"
      userName={profile.full_name || email}
      userEmail={email}
    >
      {children}
    </AppShell>
  );
}
