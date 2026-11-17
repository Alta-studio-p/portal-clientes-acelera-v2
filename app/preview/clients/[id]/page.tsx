import { getPreviewClient } from '@/lib/data/client-preview';
import { StaffClientWorkspace } from '@/components/staff-client-workspace';

export default async function ClientPreviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ call?: string; section?: string }>;
}) {
  const { id } = await params;
  const { call, section } = await searchParams;
  const {client} = await getPreviewClient(id);
  const base = `/preview/clients/${id}`;

  return <StaffClientWorkspace client={client} selectedCallId={call} section={section} callHrefBase={base} showProgramStatus={false} clientFacing readOnly />;
}
