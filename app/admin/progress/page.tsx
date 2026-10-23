import { ClientProgressDashboard } from '@/components/client-progress-dashboard';
import { getStaffProgress } from '@/lib/data/client-progress';

export default async function AdminProgressPage({ searchParams }: { searchParams: Promise<{ coach?: string; q?: string }> }) {
  const params = await searchParams;
  return <ClientProgressDashboard {...await getStaffProgress()} initialCoach={params.coach} initialSearch={params.q} />;
}
