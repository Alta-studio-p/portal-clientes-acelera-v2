import type { ClientStatus } from "@/lib/supabase/types";

const LABELS: Record<ClientStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  extension: "Extensión",
};

const STYLES: Record<ClientStatus, string> = {
  active: "bg-[--status-active-bg] text-[--status-active]",
  inactive: "bg-[--status-inactive-bg] text-[--status-inactive]",
  extension: "bg-[--status-extension-bg] text-[--status-extension]",
};

export function StatusBadge({ status }: { status: ClientStatus | string | null }) {
  const key = (status ?? "inactive") as ClientStatus;
  const label = LABELS[key] ?? status ?? "—";
  const style = STYLES[key] ?? "bg-surface-muted text-muted";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
