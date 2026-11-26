import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getMasterclass } from "@/lib/data/masterclasses";
import { MasterclassDetail } from "@/components/masterclass-detail";

export default async function AdminMasterclassDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const item = await getMasterclass(id, true);
  if (!item) notFound();
  const { saved } = await searchParams;
  return <MasterclassDetail item={item} backHref="/admin/masterclasses" editHref={`/admin/masterclasses?edit=${item.id}`}
    notice={saved === "1" ? "Masterclase guardada." : undefined} />;
}
