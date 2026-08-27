import { redirect } from "next/navigation";
import { getSessionProfile, roleHome } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSessionProfile();

  if (!session) redirect("/login");
  if (!session.profile) redirect("/login?error=no_profile");

  redirect(roleHome(session.profile.role));
}
