import { parseInline } from "@/components/markdown-lite";

export function HighlightList({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="border-y border-border bg-accent-soft/35 px-5 py-5">
      <p className="text-sm font-semibold text-accent">{heading}</p>
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
