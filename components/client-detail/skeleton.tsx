export function ClientDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-5">
        <div className="mb-4 h-4 w-32 rounded bg-surface-muted" />
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-surface-muted" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-surface-muted" />
            <div className="h-3.5 w-64 rounded bg-surface-muted" />
          </div>
        </div>
      </div>

      <div className="mb-6 h-20 rounded-[20px] border border-border/60 bg-surface-muted" />

      <div className="overflow-hidden rounded-[26px] border border-border/60 bg-surface lg:flex lg:h-[72vh] lg:min-h-[560px]">
        <div className="hidden shrink-0 space-y-2.5 border-border/60 bg-surface-muted/60 p-5 lg:block lg:w-[340px] lg:border-r">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[76px] rounded-[18px] bg-surface" />
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
