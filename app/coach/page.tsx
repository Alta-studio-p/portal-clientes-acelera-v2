import { requireRole } from '@/lib/auth';
import { getCoachByProfileId } from '@/lib/data/client-detail';
import { getClientsForCoach } from '@/lib/data/coach';
import { CoachClientsView } from '@/components/coach-clients-view';

export default async function CoachHomePage({ searchParams }: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { userId } = await requireRole(['coach']);
  const { q } = await searchParams;
  const coach = await getCoachByProfileId(userId);
  const allClients = coach ? await getClientsForCoach(coach.id) : [];
  return <CoachClientsView allClients={allClients} q={q} />;
}
