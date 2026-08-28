import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/data/client-detail";
import { ClientDetailView } from "@/components/client-detail-view";
import { DriveFolderForm } from "./drive-folder-form";

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ call?: string; drive?: string }>;
}) {
  const { id } = await params;
  const { call, drive } = await searchParams;

  const client = await getClientDetail(id);
  if (!client) notFound();

  return (
    <>
      <DriveFolderForm client={client} status={drive} />
      <ClientDetailView
        client={client}
        selectedCallId={call}
        callHrefBase={`/admin/clients/${id}`}
        showNotes
      />
    </>
  );
}
