"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { ClientStatus } from "@/lib/supabase/types";

const CLIENT_STATUSES: ClientStatus[] = ["active", "inactive", "extension"];

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

function clientPath(
  clientId: string,
  params?: { drive?: "saved" | "removed" | "invalid" | "error"; status?: "saved" | "invalid" | "error" }
) {
  const search = new URLSearchParams();
  if (params?.drive) search.set("drive", params.drive);
  if (params?.status) search.set("status", params.status);
  const suffix = search.size > 0 ? `?${search.toString()}` : "";
  return `/admin/clients/${clientId}${suffix}`;
}

export async function saveClientDriveFolder(formData: FormData) {
  await requireRole(["admin"]);

  const clientId = String(formData.get("clientId") ?? "");
  const rawFolder = String(formData.get("driveFolder") ?? "");
  const folderId = extractDriveFolderId(rawFolder);

  if (!clientId || !folderId) {
    redirect(clientPath(clientId, { drive: "invalid" }));
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
    redirect(clientPath(clientId, { drive: "error" }));
  }

  revalidatePath(clientPath(clientId));
  redirect(clientPath(clientId, { drive: "saved" }));
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
    redirect(clientPath(clientId, { drive: "error" }));
  }

  revalidatePath(clientPath(clientId));
  redirect(clientPath(clientId, { drive: "removed" }));
}

export async function updateClientStatus(formData: FormData) {
  await requireRole(["admin"]);

  const clientId = String(formData.get("clientId") ?? "");
  const status = String(formData.get("clientStatus") ?? "") as ClientStatus;

  if (!clientId || !CLIENT_STATUSES.includes(status)) {
    redirect(clientPath(clientId, { status: "invalid" }));
  }

  const supabase = await createAdminClient();
  const { error } = await supabase.from("clients").update({ status }).eq("id", clientId);

  if (error) {
    redirect(clientPath(clientId, { status: "error" }));
  }

  revalidatePath(clientPath(clientId));
  redirect(clientPath(clientId, { status: "saved" }));
}
