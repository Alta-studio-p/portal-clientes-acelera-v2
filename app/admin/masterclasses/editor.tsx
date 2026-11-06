"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import type { Masterclass } from "@/lib/data/masterclasses";
import { masterclassLocalInput, masterclassStatuses } from "@/lib/masterclasses.mjs";
import { saveMasterclass } from "./actions";

const field = "block w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-accent";
const fields = [
  { key: "title", label: "Título", maxLength: 160, required: true },
  { key: "starts_at", label: "Fecha y hora (Colombia)", type: "datetime-local", required: true },
  { key: "duration_minutes", label: "Duración (minutos)", type: "number", min: 5, max: 480 },
  { key: "live_url", label: "Enlace de Google Meet o Zoom", type: "url", maxLength: 2048 },
  { key: "drive_url", label: "Enlace del video en Google Drive", type: "url", maxLength: 2048 },
] as const;

export function MasterclassEditor({ item }: { item?: Masterclass }) {
  const [error, action, pending] = useActionState(saveMasterclass.bind(null, item?.id ?? null), "");
  const [values, setValues] = useState({
    title: item?.title ?? "",
    description: item?.description ?? "",
    status: item?.status ?? "draft",
    starts_at: item ? masterclassLocalInput(item.starts_at) : "",
    duration_minutes: item ? String(item.duration_minutes ?? "") : "60",
    live_url: item?.live_url ?? "",
    drive_url: item?.drive_url ?? "",
  });
  const change = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return (
    <form action={action} className="max-w-3xl">
      <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {fields.map(({ key, label, ...props }) => (
          <label key={key} className={key === "title" ? "sm:col-span-2" : ""}>
            <span className="mb-1.5 block text-sm font-medium">{label}</span>
            <input {...props} required={key === "duration_minutes" ? values.status !== "recording" : "required" in props && props.required} name={key} value={values[key]} onChange={(event) => change(key, event.target.value)} className={field} />
          </label>
        ))}
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium">Descripción</span>
          <textarea name="description" rows={3} maxLength={2000} value={values.description} onChange={(event) => change("description", event.target.value)} className={field} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium">Estado</span>
          <select name="status" value={values.status} onChange={(event) => change("status", event.target.value)} className={field}>
            {Object.entries(masterclassStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white disabled:opacity-60">
            <Save size={16} aria-hidden="true" />{pending ? "Guardando…" : "Guardar clase"}
          </button>
          <Link href="/admin/masterclasses" className="px-3 py-2 text-sm text-muted hover:underline">Volver</Link>
        </div>
      </fieldset>
    </form>
  );
}
