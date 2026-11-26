import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { listMasterclasses } from "@/lib/data/masterclasses";
import { MasterclassesView } from "@/components/masterclasses-view";
import { PageHeader } from "@/components/ui";
import { MasterclassEditor } from "./editor";

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

  return <MasterclassesView classes={items} basePath="/admin/masterclasses" admin
    notice={saved === "1" ? "Masterclase guardada." : undefined} />;
}
