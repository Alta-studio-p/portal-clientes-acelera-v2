import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSql } from "@/lib/db";
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

  const sql = getSql();
  const profiles = await sql`
    select id::text, email, full_name, role
    from public.profiles
    where id = ${user.id}::uuid
    limit 1
  `;
  const profile = (profiles[0] as unknown as Profile | undefined) ?? null;

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
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
