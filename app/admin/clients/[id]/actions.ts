"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

function extractDriveFolderId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const folderMatch = trimmed.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];

  const openIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openIdMatch?.[1]) return openIdMatch[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;

  return null;
}

function folderUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

function clientPath(clientId: string, status?: "saved" | "removed" | "invalid" | "error") {
  const suffix = status ? `?drive=${status}` : "";
  return `/admin/clients/${clientId}${suffix}`;
}

export async function saveClientDriveFolder(formData: FormData) {
  await requireRole(["admin"]);

  const clientId = String(formData.get("clientId") ?? "");
  const rawFolder = String(formData.get("driveFolder") ?? "");
  const folderId = extractDriveFolderId(rawFolder);

  if (!clientId || !folderId) {
    redirect(clientPath(clientId, "invalid"));
  }

  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("clients")
    .update({
      drive_folder_id: folderId,
      drive_folder_url: folderUrl(folderId),
    })
    .eq("id", clientId);

  if (error) {
    redirect(clientPath(clientId, "error"));
  }

  revalidatePath(clientPath(clientId));
  redirect(clientPath(clientId, "saved"));
}

export async function removeClientDriveFolder(formData: FormData) {
  await requireRole(["admin"]);

  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) redirect("/admin/clients");

  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("clients")
    .update({
      drive_folder_id: null,
      drive_folder_url: null,
    })
    .eq("id", clientId);

  if (error) {
    redirect(clientPath(clientId, "error"));
  }

  revalidatePath(clientPath(clientId));
  redirect(clientPath(clientId, "removed"));
}
