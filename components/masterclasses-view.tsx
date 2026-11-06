import { CalendarDays, Video } from "lucide-react";
import type { Masterclass } from "@/lib/data/masterclasses";
import { formatMasterclassDate, masterclassDriveUrl, masterclassLiveUrl } from "@/lib/masterclasses.mjs";
import { EmptyState, PageHeader } from "@/components/ui";
import { MasterclassRecording } from "@/components/masterclass-recording";

export function MasterclassesView({ classes }: { classes: Masterclass[] }) {
  const schedule = classes.filter((item) => item.status !== "recording").reverse();
  const recordings = classes.filter((item) => item.status === "recording");
  const nextId = schedule.find((item) => item.status === "scheduled")?.id;

  return <div className="mx-auto max-w-5xl">
    <PageHeader title="Masterclases" />
    <section aria-labelledby="schedule-title" className="mb-10">
      <h2 id="schedule-title" className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <CalendarDays size={18} aria-hidden="true" /> Agenda
      </h2>
      {schedule.length ? <ul className="divide-y divide-border border-y border-border">
        {schedule.map((item) => {
          const cancelled = item.status === "cancelled";
          const liveUrl = cancelled ? null : masterclassLiveUrl(item.live_url ?? "");
          return <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0 flex-1 basis-60">
              <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
                {cancelled ? <span className="text-red-700">Cancelada</span> : <>
                  {item.id === nextId && <span className="text-accent">Próxima clase</span>}
                  {item.previous_starts_at && <span className="text-amber-800">Reprogramada</span>}
                </>}
              </div>
              <h3 className="break-words font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-muted"><time dateTime={item.starts_at}>{formatMasterclassDate(item.starts_at)}</time> · Hora de Colombia</p>
              {!cancelled && item.previous_starts_at && <p className="mt-1 text-xs text-muted">Antes: {formatMasterclassDate(item.previous_starts_at)}</p>}
              {item.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{item.description}</p>}
            </div>
            {liveUrl && <a href={liveUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white">
              <Video size={16} aria-hidden="true" />Unirme en vivo
            </a>}
          </li>;
        })}
      </ul> : <EmptyState title="No hay próximas masterclases programadas" />}
    </section>
    <section aria-labelledby="recordings-title">
      <h2 id="recordings-title" className="mb-3 text-lg font-semibold">Grabaciones anteriores</h2>
      {recordings.length ? <ul className="divide-y divide-border border-y border-border">
        {recordings.map((item) => {
          const url = masterclassDriveUrl(item.drive_url ?? "");
          return <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="min-w-0 flex-1 basis-60">
              <h3 className="break-words font-medium">{item.title}</h3>
              <p className="mt-1 text-sm text-muted"><time dateTime={item.starts_at}>{formatMasterclassDate(item.starts_at, false)}</time></p>
              {item.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{item.description}</p>}
            </div>
            {url && <MasterclassRecording title={item.title} driveUrl={url} />}
          </li>;
        })}
      </ul> : <EmptyState title="Aún no hay grabaciones publicadas" />}
    </section>
  </div>;
}
