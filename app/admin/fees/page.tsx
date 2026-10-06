import { requireRole } from '@/lib/auth';
import { getCoachesWithClients } from '@/lib/data/admin';
import { getCoachFees } from '@/lib/data/coach-fees';
import { validMonth } from '@/lib/coach-fees';
import { PageHeader, EmptyState } from '@/components/ui';
import { CoachFeesDashboard } from '@/components/coach-fees-dashboard';

export default async function CoachFeesPage({ searchParams }: { searchParams: Promise<{ coach?: string; month?: string }> }) {
  await requireRole(['admin']);
  const params = await searchParams;
  const coaches = await getCoachesWithClients();
  const coach = coaches.find(c => c.id === params.coach) ?? coaches.find(c => c.is_active) ?? coaches[0];
  const month = validMonth(params.month);
  if (!coach) return <><PageHeader title="Llamadas" /><EmptyState title="Sin coaches registrados" /></>;
  const rows = await getCoachFees(coach.id, month);
  // Include former clients and clients linked to historical calls in the editing menu.
  const clients = new Map(coach.clients.map(c => [c.id, { id: c.id, name: c.full_name || c.email }]));
  rows.forEach(r => { if (r.client_id) clients.set(r.client_id, { id: r.client_id, name: r.client_name }); });
  return <CoachFeesDashboard
    coaches={coaches.map(c => ({ id: c.id, name: c.full_name || c.email }))}
    coachId={coach.id}
    month={month}
    rows={rows}
    clients={[...clients.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))}
  />;
}
