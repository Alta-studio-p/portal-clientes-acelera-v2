"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { SectionLabel } from "@/components/ui";
import { parseInline } from "@/components/markdown-lite";

export function AgreementsList({ heading = "Próximos pasos", items }: { heading?: string; items: string[] }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  if (items.length === 0) return null;

  return (
    <div>
      <SectionLabel>{heading}</SectionLabel>
      <ul>
        {items.map((item, i) => {
          const isChecked = checked[i] ?? false;
          return (
            <li key={i} className="border-b border-border/60 last:border-b-0">
              <button
                type="button"
                onClick={() => setChecked((prev) => ({ ...prev, [i]: !isChecked }))}
                aria-pressed={isChecked}
                className="-mx-1 flex w-full items-start gap-3 rounded-lg px-1 py-2.5 text-left transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                    isChecked ? "border-accent bg-accent" : "border-border bg-surface"
                  }`}
                >
                  {isChecked && <Check size={13} strokeWidth={3} className="text-white" />}
                </span>
                <span
                  className={`text-sm leading-relaxed transition ${
                    isChecked ? "text-muted-2 line-through" : "text-foreground"
                  }`}
                >
                  {parseInline(item, `ag-${i}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
