import { parseInline } from "@/components/markdown-lite";

export function HighlightList({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-surface-muted p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">{heading}</p>
      <ul className="mt-3 space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5">
            <span
              aria-hidden="true"
              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
            />
            <p className="text-sm leading-relaxed text-foreground">{parseInline(item, `hl-${i}`)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
