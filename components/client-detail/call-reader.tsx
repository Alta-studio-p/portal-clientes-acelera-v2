import Link from "next/link";
import { Play, ExternalLink, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import type { Call, CallParticipant, ClientFile } from "@/lib/supabase/types";
import { SectionLabel, EmptyState } from "@/components/ui";
import { MarkdownLite } from "@/components/markdown-lite";
import { HighlightList } from "@/components/client-detail/highlight-list";
import { TopicChips } from "@/components/client-detail/topic-chips";
import { AgreementsList } from "@/components/client-detail/agreements-list";
import { displayCallTitle } from "@/lib/call-title";
import { formatDate, formatTime, formatDuration } from "@/lib/format";
import { parseSummaryMarkdown, buildRemainingMarkdown } from "@/lib/call-summary";

const PARTICIPANT_ROLE_LABELS: Record<string, string> = {
  client: "cliente",
  internal: "equipo interno",
};

const pillButton =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

export function CallReader({
  call,
  position,
  total,
  prevHref,
  nextHref,
  files,
}: {
  call: (Call & { participants: CallParticipant[] }) | null;
  position: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
  files: ClientFile[];
}) {
  if (!call) {
    return (
      <div className="p-8">
        <EmptyState
          title="Sin llamadas registradas"
          description="Cuando haya llamadas de Fathom para este cliente, aparecerán aquí."
        />
      </div>
    );
  }

  const summaryParsed = parseSummaryMarkdown(call.summary);
  const remainingMarkdown = summaryParsed ? buildRemainingMarkdown(summaryParsed) : null;

  // "Próximos pasos": prioriza el campo next_steps propio de Fathom (más
  // corto y concreto); si no existe, cae a la sección ya parseada del
  // resumen (agrupada por persona en el cuerpo principal).
  const ownNextSteps = splitPlainList(call.next_steps);
  const nextSteps = ownNextSteps.length > 0 ? ownNextSteps : summaryParsed?.actionItems ?? [];

  const relatedFiles = files.filter((f) => f.url);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-4 lg:px-10">
        <p className="text-sm text-muted">
          {formatDate(call.started_at)} · {formatDuration(call.duration_seconds)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {call.recording_url && (
            <a href={call.recording_url} target="_blank" rel="noreferrer" className={pillButton}>
              <Play size={14} strokeWidth={2} aria-hidden="true" /> Ver grabación
            </a>
          )}
          {call.share_url && (
            <a href={call.share_url} target="_blank" rel="noreferrer" className={pillButton}>
              Abrir en Fathom <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
            </a>
          )}
          <div className="ml-1 flex items-center gap-1">
            <Link
              href={prevHref ?? "#"}
              aria-disabled={!prevHref}
              tabIndex={prevHref ? undefined : -1}
              scroll={false}
              aria-label="Sesión anterior"
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition ${
                prevHref ? "hover:bg-surface-muted" : "pointer-events-none opacity-40"
              }`}
            >
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link
              href={nextHref ?? "#"}
              aria-disabled={!nextHref}
              tabIndex={nextHref ? undefined : -1}
              scroll={false}
              aria-label="Sesión siguiente"
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition ${
                nextHref ? "hover:bg-surface-muted" : "pointer-events-none opacity-40"
              }`}
            >
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-[760px]">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
            Sesión {position} de {total}
          </p>
          <h1 className="mt-2 text-[32px] font-extrabold leading-tight tracking-tight text-foreground lg:text-[36px]">
            {displayCallTitle(call)}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {formatDate(call.started_at)} · {formatTime(call.started_at)} ·{" "}
            {formatDuration(call.duration_seconds)}
          </p>

          <div className="mt-8 space-y-8">
            {!call.summary && (
              <p className="text-sm text-muted">Sin resumen disponible para esta llamada.</p>
            )}

            {summaryParsed?.oneLiner && (
              <div>
                <SectionLabel>Propósito</SectionLabel>
                <p className="text-[16px] leading-[1.65] text-foreground">
                  {stripMarkup(summaryParsed.oneLiner)}
                </p>
              </div>
            )}

            {remainingMarkdown && (
              <div>
                <SectionLabel>Resumen de la llamada</SectionLabel>
                <div className="text-[15px] leading-[1.65] [&_p]:leading-[1.65] [&_li]:leading-[1.65]">
                  <MarkdownLite text={remainingMarkdown} />
                </div>
              </div>
            )}

            {summaryParsed && <HighlightList heading="Puntos clave" items={summaryParsed.highlights} />}

            <AgreementsList heading="Próximos pasos" items={nextSteps} />

            {relatedFiles.length > 0 && (
              <div>
                <SectionLabel>Recursos</SectionLabel>
                <ul className="space-y-1">
                  {relatedFiles.map((file) => (
                    <li key={file.id}>
                      <a
                        href={file.url!}
                        target="_blank"
                        rel="noreferrer"
                        className="-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-foreground transition hover:bg-surface-muted"
                      >
                        <FileText size={16} strokeWidth={2} className="shrink-0 text-muted-2" aria-hidden="true" />
                        <span className="truncate">{file.name || "Archivo"}</span>
                        <ExternalLink size={13} strokeWidth={2} className="ml-auto shrink-0 text-muted-2" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summaryParsed && summaryParsed.topics.length > 0 && (
              <TopicChips topics={summaryParsed.topics} />
            )}

            {call.participants.length > 0 && (
              <div>
                <SectionLabel>Participantes</SectionLabel>
                <ul className="flex flex-wrap gap-2">
                  {call.participants.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-muted"
                    >
                      {p.name || p.email}
                      {p.role_hint ? ` · ${PARTICIPANT_ROLE_LABELS[p.role_hint] ?? p.role_hint}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function splitPlainList(text: string | null): string[] {
  if (!text?.trim()) return [];
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function stripMarkup(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .trim();
}
