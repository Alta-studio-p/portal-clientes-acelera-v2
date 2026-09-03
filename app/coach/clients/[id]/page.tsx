import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getClientDetail, getCoachByProfileId } from "@/lib/data/client-detail";
import { ClientDetailView } from "@/components/client-detail-view";
import { ClientDatesSettings } from "@/components/client-dates-settings";

export default async function CoachClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ call?: string }>;
}) {
  const { userId } = await requireRole(["coach"]);
  const { id } = await params;
  const { call } = await searchParams;

  const coach = await getCoachByProfileId(userId);
  const client = await getClientDetail(id);

  if (!client || !coach) notFound();
  const isAssigned = client.coaches.some((c) => c.id === coach.id);
  if (!isAssigned) notFound();

  return (
    <ClientDetailView
      client={client}
      selectedCallId={call}
      callHrefBase={`/coach/clients/${id}`}
      backHref="/coach"
      headerActions={
        <ClientDatesSettings clientId={client.id} startDate={client.start_date} endDate={client.end_date} />
      }
    />
  );
}
