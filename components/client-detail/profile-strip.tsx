import { ChevronDown } from "lucide-react";
import { parseSummaryMarkdown, plainTextPreview } from "@/lib/call-summary";
import { stripContextIntro } from "@/lib/context-summary";
import { parseInline, MarkdownLite } from "@/components/markdown-lite";

export function ProfileStrip({ contextSummary }: { contextSummary: string | null }) {
  if (!contextSummary?.trim()) return null;

  const clean = stripContextIntro(contextSummary);
  const parsed = parseSummaryMarkdown(clean);
  const teaser = parsed?.oneLiner ?? plainTextPreview(clean);

  if (!teaser) return null;

  return (
    <details className="group mb-6 rounded-[20px] border border-border/60 bg-surface-muted p-4">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">Perfil</p>
          <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-foreground group-open:hidden">
            {parseInline(teaser, "profile-teaser")}
          </p>
        </div>
        <span className="mt-4 flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-semibold text-accent">
          <span className="group-open:hidden">Ver perfil completo</span>
          <span className="hidden group-open:inline">Ver menos</span>
          <ChevronDown size={14} strokeWidth={2.25} className="transition group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="mt-3 border-t border-border/60 pt-3">
        <MarkdownLite text={clean} />
      </div>
    </details>
  );
}
