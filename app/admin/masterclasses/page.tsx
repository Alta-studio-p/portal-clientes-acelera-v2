import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listMasterclasses } from "@/lib/data/masterclasses";
import { formatMasterclassDate, masterclassStatuses } from "@/lib/masterclasses.mjs";
import { EmptyState, PageHeader } from "@/components/ui";
import { MasterclassEditor } from "./editor";

const base = "/admin/masterclasses";

export default async function AdminMasterclassesPage({ searchParams }: {
  searchParams: Promise<{ edit?: string; saved?: string }>;
}) {
  await requireRole(["admin"]);
  const { edit, saved } = await searchParams;
  const items = await listMasterclasses(true);
  const selected = items.find((item) => item.id === edit);
  if (edit && edit !== "new" && !selected) notFound();
  if (edit) return <div className="mx-auto max-w-5xl">
    <PageHeader title={selected ? "Editar masterclase" : "Nueva masterclase"} />
    <MasterclassEditor key={edit} item={selected} />
  </div>;

  return <div className="mx-auto max-w-5xl">
    <PageHeader title="Masterclases" actions={
      <Link href={`${base}?edit=new`} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-white">
        <Plus size={16} aria-hidden="true" />Nueva clase
      </Link>
    } />
    {saved === "1" && <p role="status" className="mb-4 text-sm text-accent">Masterclase guardada.</p>}
    {items.length ? <ul className="divide-y divide-border border-y border-border">
      {items.map((item) => <li key={item.id} className="flex items-start justify-between gap-4 py-4">
        <div className="min-w-0">
          <h2 className="break-words font-medium">{item.title}</h2>
          <p className="mt-1 text-sm text-muted">{formatMasterclassDate(item.starts_at, item.status !== "recording")} · {masterclassStatuses[item.status]}</p>
        </div>
        <Link href={`${base}?edit=${item.id}`} aria-label={`Editar ${item.title}`} title="Editar clase" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface hover:bg-surface-muted">
          <Pencil size={16} aria-hidden="true" />
        </Link>
      </li>)}
    </ul> : <EmptyState title="Aún no hay masterclases" />}
  </div>;
}
