"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getClientIdsForCoach, getCoachByProfileId } from "@/lib/data/client-detail";

export interface UpdateDatesState {
  error: string | null;
  success: boolean;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Fechas del programa: las puede editar un admin o el coach asignado a ese
// cliente. Nunca tocan `status` — el estado del cliente solo lo cambia una
// persona a mano, sin importar si la fecha final ya pasó.
export async function updateClientDates(
  _prevState: UpdateDatesState,
  formData: FormData
): Promise<UpdateDatesState> {
  const session = await requireProfile();

  const clientId = String(formData.get("clientId") ?? "");
  const startDateRaw = String(formData.get("start_date") ?? "").trim();
  const endDateRaw = String(formData.get("end_date") ?? "").trim();

  if (!clientId) return { error: "Cliente inválido.", success: false };
  if (startDateRaw && !DATE_PATTERN.test(startDateRaw)) {
    return { error: "Fecha de inicio inválida.", success: false };
  }
  if (endDateRaw && !DATE_PATTERN.test(endDateRaw)) {
    return { error: "Fecha final inválida.", success: false };
  }

  if (session.profile.role === "admin") {
    // autorizado
  } else if (session.profile.role === "coach") {
    const coach = await getCoachByProfileId(session.userId);
    const assignedClientIds = coach ? await getClientIdsForCoach(coach.id) : [];
    if (!coach || !assignedClientIds.includes(clientId)) {
      return { error: "No tienes permiso para editar este cliente.", success: false };
    }
  } else {
    return { error: "No tienes permiso para editar este cliente.", success: false };
  }

  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("clients")
    .update({ start_date: startDateRaw || null, end_date: endDateRaw || null })
    .eq("id", clientId);

  if (error) return { error: "No se pudieron guardar las fechas.", success: false };

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath(`/coach/clients/${clientId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/coach");
  return { error: null, success: true };
}
