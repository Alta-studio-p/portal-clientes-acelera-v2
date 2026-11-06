"use client";

import { useId, useState } from "react";
import { ExternalLink, Play } from "lucide-react";
import { masterclassDrivePreview } from "@/lib/masterclasses.mjs";

export function MasterclassRecording({ title, driveUrl }: { title: string; driveUrl: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const preview = masterclassDrivePreview(driveUrl);
  if (!preview) return null;
  return <>
    <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-accent hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent">
      <Play size={15} aria-hidden="true" />{open ? "Cerrar grabación" : "Ver grabación"}
    </button>
    <div id={id} hidden={!open} className="min-w-0 basis-full">
      {open && <>
        <iframe src={preview} title={`Grabación: ${title}`} allowFullScreen
          referrerPolicy="no-referrer" className="aspect-video w-full rounded-lg bg-surface-muted" />
        <a href={driveUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 py-2 text-sm text-accent hover:underline">
          Abrir en Drive <ExternalLink size={14} aria-hidden="true" />
        </a>
      </>}
    </div>
  </>;
}
