import "server-only";

import records from "@/data/master-clients.json";

export type MasterClient = {
  name: string;
  aliases?: string[];
  emails?: string[];
};

export const MASTER_CLIENTS = records as MasterClient[];

export function normalizeClientIdentity(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function findMasterClient({ name, email }: { name?: string | null; email?: string | null }) {
  const normalizedName = normalizeClientIdentity(name);
  const normalizedEmail = email?.trim().toLowerCase() ?? "";

  if (normalizedEmail) {
    const byEmail = MASTER_CLIENTS.find((client) => client.emails?.some((candidate) => candidate === normalizedEmail));
    if (byEmail) return byEmail;
  }

  if (!normalizedName) return null;
  return (
    MASTER_CLIENTS.find((client) => normalizeClientIdentity(client.name) === normalizedName) ??
    MASTER_CLIENTS.find((client) => client.aliases?.some((alias) => normalizeClientIdentity(alias) === normalizedName)) ??
    null
  );
}
