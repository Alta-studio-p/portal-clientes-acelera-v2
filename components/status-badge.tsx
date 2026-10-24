import type { ClientStatus } from "@/lib/supabase/types";

const LABELS: Record<ClientStatus, string> = {
  active: "Activo",
  inactive: "Finalizado",
  extension: "Extensión",
};

const STYLES: Record<ClientStatus, string> = {
  active: "bg-[var(--status-active-bg)] text-[var(--status-active)]",
  inactive: "bg-[var(--status-inactive-bg)] text-[var(--status-inactive)]",
  extension: "bg-[var(--status-extension-bg)] text-[var(--status-extension)]",
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
