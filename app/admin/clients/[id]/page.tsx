import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import { getClientDetail } from "@/lib/data/client-detail";
import { ClientDetailView } from "@/components/client-detail-view";
import { AdminClientSettings } from "./admin-client-settings";
import { InviteClientButton } from "./invite-client-button";

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
      backHref="/admin/clients"
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <InviteClientButton clientId={id} email={client.email} name={client.full_name || client.email} linked={!!client.profile_id} />
          <Link href={`/preview/clients/${id}${call ? `?call=${encodeURIComponent(call)}` : ''}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent">
            <Eye size={16} aria-hidden="true" />Vista previa como cliente
          </Link>
          <AdminClientSettings client={client} driveStatus={drive} clientStatus={status} />
        </div>
      }
      showNotes
    />
  );
}
