import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Clock3, ExternalLink, Paperclip, Pencil, Video } from "lucide-react";
import type { Masterclass } from "@/lib/data/masterclasses";
import {
  formatMasterclassDate,
  masterclassDriveUrl,
  masterclassDrivePreview,
  masterclassFathomUrl,
  masterclassLiveUrl,
  masterclassResources,
  masterclassStatuses,
} from "@/lib/masterclasses.mjs";
import { CategoryTag, MasterclassCover } from "@/components/masterclass-card";

/** Detalle de una masterclase. La página que lo usa ya resolvió permisos y qué enlaces puede ver. */
export function MasterclassDetail({ item, backHref, editHref, notice }: {
  item: Masterclass;
  backHref: string;
  editHref?: string;
  notice?: string;
}) {
  const drive = masterclassDriveUrl(item.drive_url ?? "");
  const preview = drive ? masterclassDrivePreview(drive) : null;
  const fathom = masterclassFathomUrl(item.fathom_url ?? "");
  const live = item.status === "scheduled" ? masterclassLiveUrl(item.live_url ?? "") : null;
  const resources = masterclassResources(item.resources);
  const date = item.starts_at
    ? `${formatMasterclassDate(item.starts_at, item.status !== "recording")}${item.status === "recording" ? "" : " · Colombia"}`
    : item.published_at ? `Publicada el ${formatMasterclassDate(item.published_at, false)}` : "Sin fecha";

  return <div className="mx-auto max-w-4xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <Link href={backHref} className="inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-accent hover:bg-accent-soft">
        <ArrowLeft size={16} aria-hidden="true" />Volver a Masterclases
      </Link>
      {editHref && <Link href={editHref} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-muted">
        <Pencil size={15} aria-hidden="true" />Editar clase
      </Link>}
    </div>
    {notice && <p role="status" className="mb-4 text-sm text-accent">{notice}</p>}

    <header className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CategoryTag category={item.category} />
        {item.status !== "recording" && <span className="rounded border border-border px-2 py-0.5 text-xs text-muted">{masterclassStatuses[item.status]}</span>}
      </div>
      <h1 className="break-words text-2xl font-semibold leading-tight sm:text-3xl">{item.title}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span>{date}</span>
        {item.duration_minutes && <span className="inline-flex items-center gap-1"><Clock3 size={14} aria-hidden="true" />{item.duration_minutes} min</span>}
      </p>
      {item.previous_starts_at && item.status !== "recording" && <p className="mt-1 text-xs text-muted">Antes: {formatMasterclassDate(item.previous_starts_at)}</p>}
    </header>

    {(preview || item.cover_url || fathom || live) && <section aria-label="Grabación" className="mb-8">
      {preview && drive ? <>
        <iframe src={preview} title={`Grabación: ${item.title}`} allowFullScreen referrerPolicy="no-referrer"
          className="aspect-video w-full rounded-lg border border-border bg-surface-muted" />
        <a href={drive} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 py-2 text-sm text-accent hover:underline">
          ¿No carga el video? Abrir en Drive <ExternalLink size={14} aria-hidden="true" />
        </a>
      </> : <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {/* Sin video embebible: portada si existe; si no, solo los botones (Fathom no permite embed). */}
        {item.cover_url && <MasterclassCover item={item} large />}
        {(fathom || live) && <div className={`flex flex-wrap items-center gap-3 p-4 ${item.cover_url ? "border-t border-border" : ""}`}>
          {!item.cover_url && <p className="mr-auto text-sm text-muted">{live ? "Clase en vivo por videollamada." : "La grabación se abre en Fathom."}</p>}
          {fathom && <a href={fathom} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
            <Video size={16} aria-hidden="true" />Ver grabación<ArrowUpRight size={16} aria-hidden="true" />
          </a>}
          {live && <a href={live} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
            <Video size={16} aria-hidden="true" />Unirme en vivo
          </a>}
        </div>}
      </div>}
      {preview && fathom && <a href={fathom} target="_blank" rel="noreferrer" className="ml-4 inline-flex items-center gap-1.5 py-2 text-sm text-accent hover:underline">
        Ver en Fathom <ArrowUpRight size={14} aria-hidden="true" />
      </a>}
    </section>}

    {item.description && <section aria-labelledby="about-title" className="mb-8">
      <h2 id="about-title" className="mb-2 text-base font-semibold">Sobre esta clase</h2>
      <p className="max-w-[70ch] whitespace-pre-line text-sm leading-6 text-muted">{item.description}</p>
    </section>}

    {resources.length > 0 && <section aria-labelledby="resources-title" className="mb-8">
      <h2 id="resources-title" className="mb-2 text-base font-semibold">Materiales y recursos</h2>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {resources.map((resource, index) => <li key={`${index}-${resource.url}`}>
          <a href={resource.url} target="_blank" rel="noreferrer" className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm hover:bg-surface-muted">
            <Paperclip size={15} aria-hidden="true" className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 break-words font-medium">{resource.title}</span>
            <ArrowUpRight size={15} aria-hidden="true" className="shrink-0 text-accent" />
          </a>
        </li>)}
      </ul>
    </section>}
  </div>;
}
