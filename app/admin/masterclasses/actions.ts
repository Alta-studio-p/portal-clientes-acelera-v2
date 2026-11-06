"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { parseMasterclass } from "@/lib/masterclasses.mjs";

export async function saveMasterclass(id: string | null, _state: string, form: FormData) {
  await requireRole(["admin"]);
  if (id && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    return "No se encontró la clase.";
  }
  let value;
  try {
    value = parseMasterclass(form);
  } catch (error) {
    return error instanceof Error ? error.message : "Revisa los datos.";
  }
  const { title, description, status, startsAt, duration, live, drive } = value;
  try {
    const sql = getSql();
    if (id) {
      const updated = await sql`
        update public.masterclasses set title = ${title}, description = ${description}, status = ${status},
          previous_starts_at = case when status in ('scheduled', 'cancelled') and starts_at <> ${startsAt}::timestamptz
            then starts_at else previous_starts_at end,
          starts_at = ${startsAt}, duration_minutes = ${duration}, live_url = ${live}, drive_url = ${drive}
        where id = ${id}::uuid returning id
      `;
      if (!updated.length) return "No se encontró la clase.";
    } else {
      await sql`
        insert into public.masterclasses (title, description, status, starts_at, duration_minutes, live_url, drive_url)
        values (${title}, ${description}, ${status}, ${startsAt}, ${duration}, ${live}, ${drive})
      `;
    }
  } catch (error) {
    console.error("No se pudo guardar la masterclase", (error as { code?: string }).code);
    return "No se pudo guardar. Intenta de nuevo.";
  }
  revalidatePath("/portal/masterclasses");
  revalidatePath("/admin/masterclasses");
  redirect("/admin/masterclasses?saved=1");
}
