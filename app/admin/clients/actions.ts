"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export interface CreateClientState {
  error: string | null;
  success: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createClientAction(
  _prevState: CreateClientState,
  formData: FormData
): Promise<CreateClientState> {
  await requireRole(["admin"]);

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const coachId = String(formData.get("coachId") ?? "").trim();

  if (!fullName) {
    return { error: "El nombre es obligatorio.", success: false };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Ingresa un correo válido.", success: false };
  }

  const supabase = await createAdminClient();

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return { error: "Ya existe un cliente con ese correo.", success: false };
  }

  const { data: newClient, error } = await supabase
    .from("clients")
    .insert({ email, full_name: fullName, status: "active" })
    .select("id")
    .single();

  if (error || !newClient) {
    return { error: "No se pudo crear el cliente. Intenta de nuevo.", success: false };
  }

  if (coachId) {
    await supabase
      .from("coach_client_assignments")
      .insert({ coach_id: coachId, client_id: newClient.id, is_primary: true });
  }

  revalidatePath("/admin/clients");
  return { error: null, success: true };
}
