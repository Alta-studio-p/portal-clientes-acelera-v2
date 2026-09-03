import { SectionLabel } from "@/components/ui";
import { parseInline } from "@/components/markdown-lite";

export function AgreementsList({ heading = "Acuerdos", items }: { heading?: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <SectionLabel>{heading}</SectionLabel>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
            >
              <path
                d="M5 10.5l3 3 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="leading-relaxed">{parseInline(item, `ag-${i}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
