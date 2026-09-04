import type { ReactNode } from "react";
import type { ClientDetail } from "@/lib/data/client-detail";
import { Card, SectionLabel } from "@/components/ui";
import { ClientHeader } from "@/components/client-detail/client-header";
import { ProfileStrip } from "@/components/client-detail/profile-strip";
import { CallListPanel, type CallCardData } from "@/components/client-detail/call-list-panel";
import { MobileCallDrawer } from "@/components/client-detail/mobile-call-drawer";
import { CallReader } from "@/components/client-detail/call-reader";
import { DriveDocuments } from "@/components/drive-documents";
import { displayCallTitle } from "@/lib/call-title";
import { formatDateTime } from "@/lib/format";
import { parseSummaryMarkdown } from "@/lib/call-summary";

function stripMarkup(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
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
  // antigua).
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

  const listCalls: CallCardData[] = client.calls.map((call) => {
    const parsed = parseSummaryMarkdown(call.summary);
    const title = displayCallTitle(call);
    const preview = parsed?.oneLiner
      ? stripMarkup(parsed.oneLiner)
      : parsed?.highlights[0]
        ? stripMarkup(parsed.highlights[0])
        : null;
    const searchText = [title, parsed?.oneLiner, ...(parsed?.highlights ?? []), ...(parsed?.topics ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return {
      id: call.id,
      title,
      startedAt: call.started_at,
      durationSeconds: call.duration_seconds,
      preview,
      searchText,
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

      <MobileCallDrawer calls={listCalls} selectedCallId={selectedCall?.id ?? null} hrefBase={callHrefBase} />

      <div className="mb-6 overflow-hidden rounded-[26px] border border-border/60 bg-surface shadow-[0_30px_80px_-45px_rgba(15,23,42,0.35)] lg:flex lg:h-[72vh] lg:min-h-[560px]">
        <div className="hidden shrink-0 border-border/60 bg-surface-muted/60 lg:flex lg:w-[340px] lg:flex-col lg:border-r">
          <CallListPanel calls={listCalls} selectedCallId={selectedCall?.id ?? null} hrefBase={callHrefBase} />
        </div>

        <div className="min-w-0 flex-1">
          <CallReader
            call={selectedCall}
            position={position}
            total={total}
            prevHref={prevHref}
            nextHref={nextHref}
            files={client.files}
          />
        </div>
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
