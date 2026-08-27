import Link from "next/link";
import type { ClientDetail } from "@/lib/data/client-detail";
import { StatusBadge } from "@/components/status-badge";
import { Card, EmptyState, SectionLabel } from "@/components/ui";
import { formatDate, formatDateTime, formatDuration } from "@/lib/format";
import { displayCallTitle } from "@/lib/call-title";
import { MarkdownLite } from "@/components/markdown-lite";
import { stripContextIntro } from "@/lib/context-summary";

export function ClientDetailView({
  client,
  selectedCallId,
  callHrefBase,
  showNotes = false,
}: {
  client: ClientDetail;
  selectedCallId?: string;
  callHrefBase: string;
  showNotes?: boolean;
}) {
  const selectedCall =
    client.calls.find((c) => c.id === selectedCallId) ?? client.calls[0] ?? null;

  const firstCall = client.calls.find((c) => c.id === client.context_source_call_id);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {client.full_name || client.email}
            </h1>
            <p className="text-sm text-muted">{client.email}</p>
          </div>
          <StatusBadge status={client.status} />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-muted-2">Coach(es): </span>
            <span className="text-foreground">
              {client.coaches.length
                ? client.coaches
                    .map((c) => c.full_name || c.email)
                    .join(", ")
                : "Sin asignar"}
            </span>
          </div>
          {client.drive_folder_url && (
            <a
              href={client.drive_folder_url}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Carpeta de Drive →
            </a>
          )}
        </div>

        {showNotes && client.notes && (
          <p className="mt-3 rounded-md bg-surface-muted px-3 py-2 text-xs text-muted">
            Nota interna: {client.notes}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <SectionLabel>Contexto general</SectionLabel>
          {client.context_source_call_id && (
            <Link
              href={`${callHrefBase}?call=${client.context_source_call_id}`}
              className="text-xs font-medium text-accent hover:underline"
            >
              Ver llamada de origen →
            </Link>
          )}
        </div>

        {(firstCall || client.desired_salary_range) && (
          <dl className="mb-4 flex flex-wrap gap-x-8 gap-y-2 border-b border-border pb-4 text-sm">
            {firstCall && (
              <div>
                <dt className="text-xs text-muted-2">Primera llamada</dt>
                <dd className="font-medium text-foreground">{formatDate(firstCall.started_at)}</dd>
              </div>
            )}
            {client.desired_salary_range && (
              <div>
                <dt className="text-xs text-muted-2">Rango salarial buscado</dt>
                <dd className="font-medium text-foreground">{client.desired_salary_range}</dd>
              </div>
            )}
          </dl>
        )}

        {client.context_summary ? (
          <MarkdownLite text={stripContextIntro(client.context_summary)} />
        ) : (
          <p className="text-sm text-muted">Todavía no hay contexto general generado.</p>
        )}
        {client.context_generated_at && (
          <p className="mt-3 text-xs text-muted-2">
            Generado el {formatDate(client.context_generated_at)}
          </p>
        )}
      </Card>

      {client.calls.length === 0 ? (
        <EmptyState
          title="Sin llamadas registradas"
          description="Cuando haya llamadas de Fathom para este cliente, aparecerán aquí."
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="sticky top-6 divide-y divide-border p-0">
            <div className="px-4 py-3">
              <SectionLabel>Llamadas ({client.calls.length})</SectionLabel>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {client.calls.map((call) => {
                const active = selectedCall?.id === call.id;
                return (
                  <Link
                    key={call.id}
                    href={`${callHrefBase}?call=${call.id}`}
                    className={`block px-4 py-3 text-sm transition ${
                      active ? "bg-accent-soft" : "hover:bg-surface-muted"
                    }`}
                  >
                    <p className="truncate font-medium text-foreground">
                      {displayCallTitle(call)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-2">{formatDate(call.started_at)}</p>
                    {!call.summary && (
                      <p className="mt-1 text-[11px] font-medium text-[--status-extension]">
                        Sin resumen
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            {selectedCall ? (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {displayCallTitle(selectedCall)}
                    </h2>
                    <p className="mt-1 text-xs text-muted-2">
                      {formatDateTime(selectedCall.started_at)} ·{" "}
                      {formatDuration(selectedCall.duration_seconds)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selectedCall.recording_url && (
                      <a
                        href={selectedCall.recording_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                      >
                        Ver grabación
                      </a>
                    )}
                    {selectedCall.share_url && (
                      <a
                        href={selectedCall.share_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                      >
                        Link Fathom
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <SectionLabel>Resumen</SectionLabel>
                    {selectedCall.summary ? (
                      <MarkdownLite text={selectedCall.summary} />
                    ) : (
                      <p className="text-sm text-muted">Sin resumen disponible para esta llamada.</p>
                    )}
                  </div>

                  <div>
                    <SectionLabel>Next steps</SectionLabel>
                    {selectedCall.next_steps ? (
                      <MarkdownLite text={selectedCall.next_steps} />
                    ) : (
                      <p className="text-sm text-muted">No se registraron next steps.</p>
                    )}
                  </div>

                  {selectedCall.participants.length > 0 && (
                    <div>
                      <SectionLabel>Participantes</SectionLabel>
                      <ul className="flex flex-wrap gap-2">
                        {selectedCall.participants.map((p) => (
                          <li
                            key={p.id}
                            className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-muted"
                          >
                            {p.name || p.email}
                            {p.role_hint ? ` · ${p.role_hint}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Selecciona una llamada para ver el detalle.</p>
            )}
          </Card>
        </div>
      )}

      {client.calendarEvents.length > 0 && (
        <Card className="p-5">
          <SectionLabel>Reuniones de calendario</SectionLabel>
          <ul className="divide-y divide-border">
            {client.calendarEvents.map((event) => (
              <li key={event.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-medium text-foreground">{event.title || "Sin título"}</p>
                  <p className="text-xs text-muted-2">{formatDateTime(event.starts_at)}</p>
                </div>
                {!event.matched_call_id && (
                  <span className="rounded-full bg-[--status-extension-bg] px-2.5 py-0.5 text-xs font-medium text-[--status-extension]">
                    Sin grabación
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {client.files.length > 0 && (
        <Card className="p-5">
          <SectionLabel>Archivos de Drive</SectionLabel>
          <ul className="divide-y divide-border">
            {client.files.map((file) => (
              <li key={file.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-foreground">{file.name || "Archivo"}</span>
                {file.url && (
                  <a href={file.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    Abrir →
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
