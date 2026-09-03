import type { ReactNode } from "react";
import type { ClientDetail } from "@/lib/data/client-detail";
import { Card, SectionLabel } from "@/components/ui";
import { ClientHeader } from "@/components/client-detail/client-header";
import { ProfileStrip } from "@/components/client-detail/profile-strip";
import { CallCarousel, type CallCardData } from "@/components/client-detail/call-carousel";
import { CallReader } from "@/components/client-detail/call-reader";
import { DriveDocuments } from "@/components/drive-documents";
import { displayCallTitle } from "@/lib/call-title";
import { formatDateTime } from "@/lib/format";
import { parseSummaryMarkdown } from "@/lib/call-summary";

function monthLabel(dateStr: string | null): { key: string; label: string } | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const label = date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return { key, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

export function ClientDetailView({
  client,
  selectedCallId,
  callHrefBase,
  headerActions,
  backHref,
  showNotes = false,
}: {
  client: ClientDetail;
  selectedCallId?: string;
  callHrefBase: string;
  headerActions?: ReactNode;
  backHref?: string;
  showNotes?: boolean;
}) {
  // client.calls viene ordenado started_at desc (más reciente primero). La
  // posición de sesión se numera cronológicamente ascendente (1 = la más
  // antigua), igual que "Sesión X de N" en la referencia visual.
  const total = client.calls.length;
  const selectedIndex = selectedCallId
    ? client.calls.findIndex((c) => c.id === selectedCallId)
    : 0;
  const activeIndex = selectedIndex === -1 ? 0 : selectedIndex;
  const selectedCall = client.calls[activeIndex] ?? null;
  const position = total - activeIndex;

  // "Anterior" = sesión anterior en el tiempo (índice mayor, más antigua).
  // "Siguiente" = sesión posterior en el tiempo (índice menor, más reciente).
  const prevCall = client.calls[activeIndex + 1];
  const nextCall = client.calls[activeIndex - 1];
  const prevHref = prevCall ? `${callHrefBase}?call=${prevCall.id}` : null;
  const nextHref = nextCall ? `${callHrefBase}?call=${nextCall.id}` : null;

  const carouselCalls: CallCardData[] = client.calls.map((call) => {
    const parsed = parseSummaryMarkdown(call.summary);
    const title = displayCallTitle(call);
    const month = monthLabel(call.started_at);
    const searchText = [title, parsed?.oneLiner, ...(parsed?.highlights ?? []), ...(parsed?.topics ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      id: call.id,
      title,
      startedAt: call.started_at,
      durationSeconds: call.duration_seconds,
      searchText,
      topics: parsed?.topics ?? [],
      monthKey: month?.key ?? null,
      monthLabel: month?.label ?? null,
    };
  });

  return (
    <div>
      <ClientHeader client={client} backHref={backHref} headerActions={headerActions} />

      <ProfileStrip contextSummary={client.context_summary} />

      {showNotes && client.notes && (
        <p className="mb-6 rounded-md bg-surface-muted px-3 py-2 text-xs text-muted">
          Nota interna: {client.notes}
        </p>
      )}

      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-foreground">Historial de llamadas</h2>
          <span className="text-sm text-muted-2">{total} sesiones</span>
        </div>
        <CallCarousel calls={carouselCalls} selectedCallId={selectedCall?.id ?? null} hrefBase={callHrefBase} />
      </div>

      <div className="mb-6">
        <CallReader
          call={selectedCall}
          position={position}
          total={total}
          prevHref={prevHref}
          nextHref={nextHref}
          files={client.files}
        />
      </div>

      {client.calendarEvents.length > 0 && (
        <Card className="mb-6 p-5">
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

      <DriveDocuments
        files={client.files}
        folderId={client.drive_folder_id}
        folderUrl={client.drive_folder_url}
      />
    </div>
  );
}
