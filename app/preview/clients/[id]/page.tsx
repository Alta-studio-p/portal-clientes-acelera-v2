import { getPreviewClient } from '@/lib/data/client-preview';
import { ClientDetailView } from '@/components/client-detail-view';

export default async function ClientPreviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ call?: string }>;
}) {
  const { id } = await params;
  const { call } = await searchParams;
  const {client} = await getPreviewClient(id);
  const base = `/preview/clients/${id}`;

  return <ClientDetailView client={client} selectedCallId={call} callHrefBase={base} showProgramStatus={false} />;
}
