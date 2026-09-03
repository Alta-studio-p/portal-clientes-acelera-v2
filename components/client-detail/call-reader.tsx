import Link from "next/link";
import type { Call, CallParticipant, ClientFile } from "@/lib/supabase/types";
import { Card, SectionLabel, EmptyState } from "@/components/ui";
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
      <EmptyState
        title="Sin llamadas registradas"
        description="Cuando haya llamadas de Fathom para este cliente, aparecerán aquí."
      />
    );
  }

  const summaryParsed = parseSummaryMarkdown(call.summary);
  const remainingMarkdown = summaryParsed ? buildRemainingMarkdown(summaryParsed) : null;

  // "Acuerdos": prioriza el campo next_steps propio de Fathom (más corto y
  // concreto); si no existe, cae a la sección "Próximos pasos" ya parseada
  // del resumen (agrupada por persona en el cuerpo principal).
  const ownNextSteps = splitPlainList(call.next_steps);
  const agreements = ownNextSteps.length > 0 ? ownNextSteps : summaryParsed?.actionItems ?? [];

  const relatedFiles = files.filter((f) => f.url);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_300px]">
      <Card className="min-w-0 p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-2">
              SESIÓN {position} DE {total}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground lg:text-xl">
              {displayCallTitle(call)}
            </h2>
            <p className="mt-1.5 text-xs text-muted-2">
              {formatDate(call.started_at)} · {formatTime(call.started_at)} ·{" "}
              {formatDuration(call.duration_seconds)}
              {call.participants.length > 0 && (
                <>
                  {" "}
                  ·{" "}
                  {call.participants
                    .map((p) => p.name || p.email)
                    .filter(Boolean)
                    .join(", ")}
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href={prevHref ?? "#"}
              aria-disabled={!prevHref}
              tabIndex={prevHref ? undefined : -1}
              scroll={false}
              className={`rounded-md border border-border px-3 py-1.5 text-xs font-medium transition ${
                prevHref
                  ? "text-foreground hover:bg-surface-muted"
                  : "pointer-events-none text-muted-2 opacity-50"
              }`}
            >
              ← Anterior
            </Link>
            <Link
              href={nextHref ?? "#"}
              aria-disabled={!nextHref}
              tabIndex={nextHref ? undefined : -1}
              scroll={false}
              className={`rounded-md border border-border px-3 py-1.5 text-xs font-medium transition ${
                nextHref
                  ? "text-foreground hover:bg-surface-muted"
                  : "pointer-events-none text-muted-2 opacity-50"
              }`}
            >
              Siguiente →
            </Link>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {call.recording_url && (
            <a
              href={call.recording_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted"
            >
              ▶ Ver grabación
            </a>
          )}
          {call.share_url && (
            <a
              href={call.share_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted"
            >
              Abrir en Fathom ↗
            </a>
          )}
        </div>

        <div className="mx-auto mt-6 max-w-2xl space-y-6">
          {!call.summary && (
            <p className="text-sm text-muted">Sin resumen disponible para esta llamada.</p>
          )}

          {summaryParsed?.oneLiner && (
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
                En una frase
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                {stripMarkup(summaryParsed.oneLiner)}
              </p>
            </div>
          )}

          {summaryParsed && (
            <HighlightList heading="Lo más importante" items={summaryParsed.highlights} />
          )}

          {remainingMarkdown && (
            <div>
              <SectionLabel>Resumen de la llamada</SectionLabel>
              <MarkdownLite text={remainingMarkdown} />
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-5">
        {agreements.length > 0 && (
          <Card className="p-4">
            <AgreementsList items={agreements} />
          </Card>
        )}

        {summaryParsed && summaryParsed.topics.length > 0 && (
          <Card className="p-4">
            <TopicChips topics={summaryParsed.topics} />
          </Card>
        )}

        {relatedFiles.length > 0 && (
          <Card className="p-4">
            <SectionLabel>Archivos y enlaces</SectionLabel>
            <ul className="space-y-1.5">
              {relatedFiles.map((file) => (
                <li key={file.id}>
                  <a
                    href={file.url!}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition hover:bg-surface-muted"
                  >
                    <span className="truncate">{file.name || "Archivo"}</span>
                    <span aria-hidden="true" className="shrink-0 text-muted-2">
                      ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {call.participants.length > 0 && (
          <Card className="p-4">
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
          </Card>
        )}
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
