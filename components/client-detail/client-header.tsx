import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { ClientDetail } from "@/lib/data/client-detail";
import { StatusBadge } from "@/components/status-badge";
import { ProgramAlertBadge } from "@/components/program-alert-badge";
import { initials } from "@/lib/format";
import { visibleClientEmail } from '@/lib/client-contact.mjs';

export function ClientHeader({
  client,
  backHref,
  headerActions,
  showProgramStatus = true,
}: {
  client: ClientDetail;
  backHref?: string;
  headerActions?: ReactNode;
  showProgramStatus?: boolean;
}) {
  const coachNames = client.coaches.map((c) => c.full_name || c.email).join(", ");
  const email=visibleClientEmail(client);

  return (
    <div className="mb-5">
      {backHref && (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" /> Todos los clientes
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-base font-semibold text-accent"
          >
            {initials(client.full_name, email)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="break-words text-2xl font-semibold leading-tight text-foreground [overflow-wrap:anywhere]">
                {client.full_name || email || 'Cliente'}
              </h1>
              {showProgramStatus && <StatusBadge status={client.status} />}
              {showProgramStatus && <ProgramAlertBadge status={client.status} end_date={client.end_date} />}
            </div>
            <p className="mt-1 break-words text-sm text-muted [overflow-wrap:anywhere]">
              <span title={client.email_source==='account'?'Correo de la cuenta':client.email_source==='onboarding'?'Correo registrado en el onboarding':undefined}>{email || 'Sin correo registrado'}</span>
              {coachNames && (
                <>
                  <span className="mx-1.5 text-muted-2">·</span>
                  Coach{client.coaches.length > 1 ? "es" : ""} · {coachNames}
                </>
              )}
            </p>
          </div>
        </div>

        {headerActions && <div className="flex max-w-full flex-wrap items-center gap-2">{headerActions}</div>}
      </div>
    </div>
  );
}
