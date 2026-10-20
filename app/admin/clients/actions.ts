"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { findMasterClient, normalizeClientIdentity } from "@/lib/master-clients";

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
  const masterClient = findMasterClient({ name: fullName, email });
  if (!masterClient || normalizeClientIdentity(masterClient.name) !== normalizeClientIdentity(fullName)) {
    return { error: "Solo puedes registrar clientes de la lista maestra.", success: false };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Ingresa un correo válido.", success: false };
  }

  const sql = getSql();
  const [existing] = await sql`select id from public.clients where lower(email) = ${email} limit 1`;

  if (existing) {
    return { error: "Ya existe un cliente con ese correo.", success: false };
  }

  const clientId = randomUUID();
  const assignmentId = coachId ? randomUUID() : null;
  try {
    await sql.transaction(async (tx) => {
      await tx`
        insert into public.clients (id, email, full_name, status)
        values (${clientId}::uuid, ${email}, ${masterClient.name}, 'active')
      `;
      if (coachId && assignmentId) {
        await tx`
        insert into public.coach_client_assignments (id, coach_id, client_id, is_primary)
        values (${assignmentId}::uuid, ${coachId}::uuid, ${clientId}::uuid, true)
        `;
      }
    });
  } catch {
    return { error: "No se pudo crear el cliente. Intenta de nuevo.", success: false };
  }

  revalidatePath("/admin/clients");
  return { error: null, success: true };
}
