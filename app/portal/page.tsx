import { requireRole } from "@/lib/auth";
import { getClientByProfileId, getClientDetail } from "@/lib/data/client-detail";
import { StaffClientWorkspace } from "@/components/staff-client-workspace";
import { EmptyState } from "@/components/ui";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ call?: string; section?: string }>;
}) {
  const { userId } = await requireRole(["client"]);
  const { call, section } = await searchParams;

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

  return <StaffClientWorkspace client={client} selectedCallId={call} section={section} callHrefBase="/portal" showProgramStatus={false} clientFacing readOnly />;
}
