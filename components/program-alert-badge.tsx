import type { ClientStatus } from "@/lib/supabase/types";
import { getProgramAlert } from "@/lib/program-dates";

export function ProgramAlertBadge({
  status,
  end_date,
}: {
  status: ClientStatus | string | null;
  end_date: string | null;
}) {
  const alert = getProgramAlert({ status, end_date });
  if (!alert) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-[--alert-warning-bg] px-2.5 py-0.5 text-xs font-medium text-[--alert-warning]">
      {alert.label}
    </span>
  );
}
