import { notFound } from 'next/navigation';
import { requirePreviewCoach, getPreviewUnassignedCalls } from '@/lib/data/coach-preview';
import { getClientsForCoach } from '@/lib/data/coach';
import { getClientDetail } from '@/lib/data/client-detail';
import { getCoachFees } from '@/lib/data/coach-fees';
import { validMonth } from '@/lib/coach-fees';
import { CoachClientsView } from '@/components/coach-clients-view';
import { CoachFeesDashboard } from '@/components/coach-fees-dashboard';
import { ClientDetailView } from '@/components/client-detail-view';
import { CallAssignmentQueue } from '@/components/call-assignment-queue';
import { PageHeader } from '@/components/ui';
import { ClientProgressDashboard } from '@/components/client-progress-dashboard';
import { getStaffProgress } from '@/lib/data/client-progress';

export default async function CoachPreviewPage({ params, searchParams }: {
  params: Promise<{ id: string; view?: string[] }>;
  searchParams: Promise<{ q?: string; month?: string; call?: string }>;
}) {
  const { id, view = [] } = await params;
  // Check here as well as in the layout: nested pages can render independently.
  const coach = await requirePreviewCoach(id);
  const query = await searchParams;
  const base = `/preview/coaches/${coach.id}`;
  if (view.length === 1 && view[0] === 'progress') return <ClientProgressDashboard {...await getStaffProgress(coach.id)} readOnly basePath={base} />;
  if (!view.length) return <CoachClientsView allClients={await getClientsForCoach(coach.id)} q={query.q} basePath={base} />;
  if (view.length === 1 && view[0] === 'fees') {
    const month = validMonth(query.month);
    const rows = await getCoachFees(coach.id, month);
    const clients = new Map(rows.filter(r => r.client_id).map(r => [r.client_id!, { id: r.client_id!, name: r.client_name }]));
    return <CoachFeesDashboard readOnly basePath={`${base}/fees`} clientBasePath={`${base}/clients`} coaches={[{ id: coach.id, name: coach.full_name || coach.email }]} coachId={coach.id} month={month} rows={rows} clients={[...clients.values()]} />;
  }
  if (view.length === 1 && view[0] === 'unassigned') return <div>
    <PageHeader title="Asignar clientes" />
    <CallAssignmentQueue calls={await getPreviewUnassignedCalls(coach.id)} clients={[]} role="coach" readOnly />
  </div>;
  if (view.length === 2 && view[0] === 'clients') {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(view[1])) notFound();
    const assigned = await getClientsForCoach(coach.id);
    if (!assigned.some(c => c.id === view[1])) notFound();
    const client = await getClientDetail(view[1]);
    if (!client) notFound();
    return <ClientDetailView client={client} selectedCallId={query.call} callHrefBase={`${base}/clients/${client.id}`} backHref={base} />;
  }
  notFound();
}
