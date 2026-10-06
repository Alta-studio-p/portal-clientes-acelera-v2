import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Eye } from 'lucide-react';
import { requireRole } from '@/lib/auth';
import { getClientDetail } from '@/lib/data/client-detail';
import { AppShell } from '@/components/app-shell';
import { ClientDetailView } from '@/components/client-detail-view';

export default async function ClientPreviewPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ call?: string }>;
}) {
  const { profile, email } = await requireRole(['admin']);
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { call } = await searchParams;
  const client = await getClientDetail(id);
  if (!client) notFound();
  const base = `/preview/clients/${id}`;

  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-accent-soft px-4 py-2 md:px-8">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-accent"><Eye size={16} aria-hidden="true" />Vista previa como cliente</p>
      <Link href={`/admin/clients/${id}${call ? `?call=${encodeURIComponent(call)}` : ''}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
        <ArrowLeft size={16} aria-hidden="true" />Volver a administración
      </Link>
    </div>
    <AppShell navItems={[{ href: base, label: 'Mi progreso' }]} roleLabel="Admin · Vista previa" userName={profile.full_name || email} userEmail={email}>
      <ClientDetailView client={client} selectedCallId={call} callHrefBase={base} showProgramStatus={false} />
    </AppShell>
  </>;
}
