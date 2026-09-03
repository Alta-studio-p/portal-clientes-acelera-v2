import Link from "next/link";
import type { ReactNode } from "react";
import type { ClientDetail } from "@/lib/data/client-detail";
import { StatusBadge } from "@/components/status-badge";
import { ProgramAlertBadge } from "@/components/program-alert-badge";
import { initials } from "@/lib/format";

export function ClientHeader({
  client,
  backHref,
  headerActions,
}: {
  client: ClientDetail;
  backHref?: string;
  headerActions?: ReactNode;
}) {
  const coachNames = client.coaches.map((c) => c.full_name || c.email).join(", ");

  return (
    <div className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-foreground"
        >
          <span aria-hidden="true">←</span> Todos los clientes
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent"
          >
            {initials(client.full_name, client.email)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold text-foreground">
                {client.full_name || client.email}
              </h1>
              <StatusBadge status={client.status} />
              <ProgramAlertBadge status={client.status} end_date={client.end_date} />
            </div>
            <p className="mt-0.5 truncate text-sm text-muted">
              {client.email}
              {coachNames && (
                <>
                  <span className="mx-1.5 text-muted-2">·</span>
                  Coach{client.coaches.length > 1 ? "es" : ""} · {coachNames}
                </>
              )}
            </p>
          </div>
        </div>

        {headerActions && <div className="flex shrink-0 items-center gap-2">{headerActions}</div>}
      </div>
    </div>
  );
}
