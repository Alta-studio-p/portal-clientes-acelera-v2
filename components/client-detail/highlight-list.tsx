import { SectionLabel } from "@/components/ui";
import { parseInline } from "@/components/markdown-lite";

export function HighlightList({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <SectionLabel>{heading}</SectionLabel>
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-sm leading-relaxed text-foreground">{parseInline(item, `hl-${i}`)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
