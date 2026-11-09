export function ClientDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-5">
        <div className="mb-4 h-4 w-32 rounded bg-surface-muted" />
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 shrink-0 rounded-lg bg-surface-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-6 w-full max-w-48 rounded bg-surface-muted" />
            <div className="h-3.5 w-full max-w-64 rounded bg-surface-muted" />
          </div>
        </div>
      </div>

      <div className="mb-6 h-20 border-y border-border bg-surface-muted" />

      <div className="overflow-hidden rounded-lg border border-border bg-surface lg:flex lg:h-[74vh] lg:min-h-[560px]">
        <div className="hidden shrink-0 space-y-2 border-border bg-background p-4 lg:block lg:w-[300px] lg:border-r xl:w-[320px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[90px] rounded-lg bg-surface" />
          ))}
        </div>
        <div className="flex-1 space-y-4 p-8">
          <div className="h-8 w-2/3 rounded bg-surface-muted" />
          <div className="h-4 w-1/3 rounded bg-surface-muted" />
          <div className="mt-6 space-y-2">
            <div className="h-3.5 w-full rounded bg-surface-muted" />
            <div className="h-3.5 w-full rounded bg-surface-muted" />
            <div className="h-3.5 w-2/3 rounded bg-surface-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
