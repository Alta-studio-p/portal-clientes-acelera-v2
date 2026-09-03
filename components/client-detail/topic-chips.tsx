import { SectionLabel } from "@/components/ui";

export function TopicChips({ heading = "Temas", topics }: { heading?: string; topics: string[] }) {
  if (topics.length === 0) return null;

  return (
    <div>
      <SectionLabel>{heading}</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {topics.map((topic) => (
          <span
            key={topic}
            className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground"
          >
            {topic}
          </span>
        ))}
      </div>
    </div>
  );
}
