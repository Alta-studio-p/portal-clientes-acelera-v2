import { ClientDatesForm } from "@/components/client-dates-form";

export function ClientDatesSettings({
  clientId,
  startDate,
  endDate,
}: {
  clientId: string;
  startDate: string | null;
  endDate: string | null;
}) {
  return (
    <details className="group relative">
      <summary
        aria-label="Editar fechas del programa"
        className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted transition hover:bg-surface-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
      >
        Fechas del programa
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-[min(320px,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-4 text-left shadow-lg">
        <ClientDatesForm clientId={clientId} startDate={startDate} endDate={endDate} />
      </div>
    </details>
  );
}
