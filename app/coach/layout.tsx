import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getCoachByProfileId } from "@/lib/data/client-detail";
import { getBillableCoachIds } from "@/lib/data/coach-fees";
import { AppShell } from "@/components/app-shell";

const NAV_ITEMS = [
  { href: "/coach", label: "Mis clientes" },
  { href: "/coach/progress", label: "Progreso" },
  { href: "/coach/fees", label: "Mis llamadas" },
  { href: "/coach/unassigned", label: "Sin cliente" },
];

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const { profile, email, userId } = await requireRole(["coach"]);

  const coach = await getCoachByProfileId(userId);
  if (!coach) redirect("/login?error=no_profile");

  const billable = (await getBillableCoachIds()).has(coach.id);
  const navItems = billable ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== "/coach/fees");

  return (
    <AppShell
      navItems={navItems}
      roleLabel="Coach"
      userName={profile.full_name || email}
      userEmail={email}
      searchAction="/coach"
    >
      {children}
    </AppShell>
  );
}
