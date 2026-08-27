import { requireRole } from "@/lib/auth";
import { getClientByProfileId, getClientDetail } from "@/lib/data/client-detail";
import { ClientDetailView } from "@/components/client-detail-view";
import { EmptyState } from "@/components/ui";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ call?: string }>;
}) {
  const { userId } = await requireRole(["client"]);
  const { call } = await searchParams;

  const clientRef = await getClientByProfileId(userId);

  if (!clientRef) {
    return (
      <EmptyState
        title="Tu perfil aún no está vinculado a un cliente"
        description="Contacta a Acelera para que vinculen tu acceso a tu información de coaching."
      />
    );
  }

  const client = await getClientDetail(clientRef.id);
  if (!client) {
    return (
      <EmptyState
        title="Tu perfil aún no está vinculado a un cliente"
        description="Contacta a Acelera para que vinculen tu acceso a tu información de coaching."
      />
    );
  }

  return <ClientDetailView client={client} selectedCallId={call} callHrefBase="/portal" />;
}
