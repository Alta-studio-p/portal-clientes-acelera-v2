import { ClientProgressDashboard } from '@/components/client-progress-dashboard';
import { getStaffProgress } from '@/lib/data/client-progress';

export default async function CoachProgressPage() {
  return <ClientProgressDashboard {...await getStaffProgress()} basePath="/coach" />;
}
