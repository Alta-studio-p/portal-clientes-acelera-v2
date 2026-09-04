import { SectionLabel } from "@/components/ui";

export function TopicChips({ heading = "Temas", topics }: { heading?: string; topics: string[] }) {
  if (topics.length === 0) return null;

  return (
    <div>
      <SectionLabel>{heading}</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => (
          <span
            key={topic}
            className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground"
          >
            {topic}
          </span>
        ))}
      </div>
    </div>
  );
}
