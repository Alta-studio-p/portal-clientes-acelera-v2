export function ClientDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="mb-3 h-4 w-32 rounded bg-surface-muted" />
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-surface-muted" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded bg-surface-muted" />
            <div className="h-3.5 w-64 rounded bg-surface-muted" />
          </div>
        </div>
      </div>

      <div className="mb-6 h-20 rounded-xl border border-border bg-surface-muted" />

      <div className="mb-6">
        <div className="mb-3 h-4 w-40 rounded bg-surface-muted" />
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 w-56 shrink-0 rounded-xl border border-border bg-surface-muted" />
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="h-96 rounded-xl border border-border bg-surface-muted" />
        <div className="space-y-5">
          <div className="h-32 rounded-xl border border-border bg-surface-muted" />
          <div className="h-24 rounded-xl border border-border bg-surface-muted" />
        </div>
      </div>
    </div>
  );
}
