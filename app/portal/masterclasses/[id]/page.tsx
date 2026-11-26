import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getMasterclass } from "@/lib/data/masterclasses";
import { MasterclassDetail } from "@/components/masterclass-detail";

export default async function MasterclassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["client"]);
  const item = await getMasterclass((await params).id);
  if (!item) notFound();
  return <MasterclassDetail item={item} backHref="/portal/masterclasses" />;
}
