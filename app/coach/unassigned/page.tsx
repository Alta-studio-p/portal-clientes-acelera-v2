import { requireRole } from '@/lib/auth';
import { getCallAssignmentQueue } from '@/lib/data/call-assignment';
import { CallAssignmentQueue } from '@/components/call-assignment-queue';
import { PageHeader } from '@/components/ui';

export default async function UnassignedCallsPage() {
  await requireRole(['coach']);
  const queue = await getCallAssignmentQueue();
  return <div>
    <PageHeader title="Asignar clientes" />
    <CallAssignmentQueue {...queue} role="coach" />
  </div>;
}
