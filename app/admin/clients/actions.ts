"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
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

  const clientId = randomUUID();
  const assignmentId = coachId ? randomUUID() : null;
  try {
    const { error: clientError } = await supabase
      .from("clients")
      .insert({ id: clientId, email, full_name: fullName, status: "active" });
    if (clientError) throw clientError;

    if (coachId && assignmentId) {
      const { error: assignmentError } = await supabase
        .from("coach_client_assignments")
        .insert({ id: assignmentId, coach_id: coachId, client_id: clientId, is_primary: true });
      if (assignmentError) throw assignmentError;
    }

    const sql = getSql();
    const queries = [
      sql`
        insert into public.clients (id, email, full_name, status)
        values (${clientId}::uuid, ${email}, ${fullName}, 'active')
      `,
    ];
    if (coachId && assignmentId) {
      queries.push(sql`
        insert into public.coach_client_assignments (id, coach_id, client_id, is_primary)
        values (${assignmentId}::uuid, ${coachId}::uuid, ${clientId}::uuid, true)
      `);
    }
    await sql.transaction(queries);
  } catch {
    return { error: "No se pudo crear el cliente. Intenta de nuevo.", success: false };
  }

  revalidatePath("/admin/clients");
  return { error: null, success: true };
}
