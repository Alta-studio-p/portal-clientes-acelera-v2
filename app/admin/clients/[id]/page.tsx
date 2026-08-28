import { notFound } from "next/navigation";
import { getClientDetail } from "@/lib/data/client-detail";
import { ClientDetailView } from "@/components/client-detail-view";
import { AdminClientSettings } from "./admin-client-settings";

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ call?: string; drive?: string; status?: string }>;
}) {
  const { id } = await params;
  const { call, drive, status } = await searchParams;

  const client = await getClientDetail(id);
  if (!client) notFound();

  return (
    <ClientDetailView
      client={client}
      selectedCallId={call}
      callHrefBase={`/admin/clients/${id}`}
      headerActions={
        <AdminClientSettings client={client} driveStatus={drive} clientStatus={status} />
      }
      showNotes
    />
  );
}
