import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getCoachByProfileId } from '@/lib/data/client-detail';
import { getCoachFees } from '@/lib/data/coach-fees';
import { validMonth } from '@/lib/coach-fees';
import { CoachFeesDashboard } from '@/components/coach-fees-dashboard';

export default async function MyFeesPage({ searchParams }: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { userId } = await requireRole(['coach']);
  const coach = await getCoachByProfileId(userId);
  if (!coach) redirect('/login?error=no_profile');
  const { month: requestedMonth } = await searchParams;
  const month = validMonth(requestedMonth);
  // The coach comes exclusively from the authenticated profile, never the URL.
  const rows = await getCoachFees(coach.id, month);
  const clients = new Map<string, { id: string; name: string }>();
  rows.forEach(row => {
    if (row.client_id) clients.set(row.client_id, { id: row.client_id, name: row.client_name });
  });
  return <CoachFeesDashboard
    readOnly
    coaches={[{ id: coach.id, name: coach.full_name || coach.email }]}
    coachId={coach.id}
    month={month}
    rows={rows}
    clients={[...clients.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))}
  />;
}
