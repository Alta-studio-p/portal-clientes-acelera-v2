import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export async function getSessionProfile(): Promise<{
  userId: string;
  email: string;
  profile: Profile | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? "",
    profile: profile as Profile | null,
  };
}

export async function requireProfile(): Promise<{
  userId: string;
  email: string;
  profile: Profile;
}> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/login?error=no_profile");
  return { userId: session.userId, email: session.email, profile: session.profile };
}

export async function requireRole(roles: Profile["role"][]) {
  const session = await requireProfile();
  if (!roles.includes(session.profile.role)) {
    redirect("/");
  }
  return session;
}

export function roleHome(role: Profile["role"]): string {
  if (role === "admin") return "/admin";
  if (role === "coach") return "/coach";
  return "/portal";
}
