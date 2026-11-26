"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import type { Masterclass } from "@/lib/data/masterclasses";
import {
  formatMasterclassResources,
  masterclassCategories,
  masterclassLocalInput,
  masterclassResources,
  masterclassStatuses,
} from "@/lib/masterclasses.mjs";
import { saveMasterclass } from "./actions";

const field = "block w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const fields = [
  { key: "title", label: "Título", maxLength: 160, required: true },
  { key: "starts_at", label: "Fecha y hora (Colombia)", type: "datetime-local", required: true },
  { key: "duration_minutes", label: "Duración (minutos)", type: "number", min: 5, max: 480 },
  { key: "live_url", label: "Enlace de Google Meet o Zoom", type: "url", maxLength: 2048 },
  { key: "drive_url", label: "Enlace del video en Google Drive", type: "url", maxLength: 2048 },
  { key: "fathom_url", label: "Grabación de Fathom", type: "url", maxLength: 2048 },
  { key: "cover_url", label: "Imagen de portada (opcional)", type: "url", maxLength: 2048 },
] as const;

export function MasterclassEditor({ item }: { item?: Masterclass }) {
  const [error, action, pending] = useActionState(saveMasterclass.bind(null, item?.id ?? null), "");
  const [values, setValues] = useState({
    title: item?.title ?? "",
    description: item?.description ?? "",
    status: item?.status ?? "draft",
    starts_at: item?.starts_at ? masterclassLocalInput(item.starts_at) : "",
    duration_minutes: item ? String(item.duration_minutes ?? "") : "60",
    live_url: item?.live_url ?? "",
    drive_url: item?.drive_url ?? "",
    fathom_url: item?.fathom_url ?? "",
    cover_url: item?.cover_url ?? "",
    resources: formatMasterclassResources(masterclassResources(item?.resources)),
    category: (item?.category ?? "") as string,
  });
  const change = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const guide = values.category === "guides";
  const required = (key: (typeof fields)[number]["key"]) =>
    key === "title" ? true
      : key === "starts_at" ? !guide
        : key === "duration_minutes" ? !guide && values.status !== "recording"
          : false;
  const statuses = Object.entries(masterclassStatuses).filter(([value]) => !guide || value === "draft" || value === "recording");
  return (
    <form action={action} className="max-w-3xl">
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-sm font-medium">Categoría <span className="text-red-700" aria-hidden="true">*</span></span>
          <select name="category" required value={values.category} onChange={(event) => {
            const category = event.target.value;
            setValues((current) => ({
              ...current,
              category,
              // Las guías no se programan en vivo.
              status: category === "guides" && !["draft", "recording"].includes(current.status) ? "draft" : current.status,
            }));
          }} className={field}>
            <option value="" disabled>Selecciona una categoría</option>
            {Object.entries(masterclassCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium">Estado</span>
          <select name="status" value={values.status} onChange={(event) => change("status", event.target.value)} className={field}>
            {statuses.map(([value, label]) => <option key={value} value={value}>{guide && value === "recording" ? "Publicada" : label}</option>)}
          </select>
        </label>
        {fields.map(({ key, label, ...props }) => (
          <label key={key} className={key === "title" ? "sm:col-span-2" : ""}>
            <span className="mb-1.5 block text-sm font-medium">{key === "starts_at" && guide ? "Fecha de la clase en vivo (opcional)" : label}</span>
            <input {...props} required={required(key)} name={key} value={values[key]} onChange={(event) => change(key, event.target.value)} className={field} />
          </label>
        ))}
        {guide && <p className="text-xs text-muted sm:col-span-2">Si la guía no tiene fecha en vivo, se mostrará la fecha en que se publique.</p>}
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Descripción</span>
          <textarea name="description" rows={3} maxLength={2000} value={values.description} onChange={(event) => change("description", event.target.value)} className={field} />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Materiales y recursos (opcional)</span>
          <textarea name="resources" rows={3} value={values.resources} onChange={(event) => change("resources", event.target.value)}
            placeholder={"Uno por línea: Nombre | https://…\nPlantilla de CV | https://docs.google.com/…"} className={field} />
          <span className="mt-1 block text-xs text-muted">Visibles para todos los clientes cuando la clase esté publicada. Revisa los permisos de cada enlace.</span>
        </label>
        {item?.source_call_id && <p className="text-sm text-amber-900 sm:col-span-2">Detectada por IA. Revisa que sea una clase grupal, elige su categoría y confirma que la grabación pueda compartirse con todos los clientes antes de publicarla.</p>}
        {values.status === "recording" && <p className="text-sm text-accent sm:col-span-2">Esta {guide ? "guía" : "grabación"} será visible para todos los clientes.</p>}
        {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white disabled:opacity-60">
            <Save size={16} aria-hidden="true" />{pending ? "Guardando…" : "Guardar clase"}
          </button>
          <Link href={item ? `/admin/masterclasses/${item.id}` : "/admin/masterclasses"} className="px-3 py-2 text-sm text-muted hover:underline">Volver</Link>
        </div>
      </fieldset>
    </form>
  );
}
