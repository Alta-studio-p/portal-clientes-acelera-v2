import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye } from 'lucide-react';
import { requirePreviewCoach } from '@/lib/data/coach-preview';
import { AppShell } from '@/components/app-shell';

export default async function CoachPreviewLayout({ children, params }: {
  children: ReactNode; params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const coach = await requirePreviewCoach(id);
  const base = `/preview/coaches/${coach.id}`;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-accent-soft px-4 py-2 md:px-8">
      <p className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-accent"><Eye size={16} className="shrink-0" aria-hidden="true" /><span>Vista previa como coach: {coach.full_name || coach.email} · Solo lectura</span></p>
      <Link href="/admin/coaches" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"><ArrowLeft size={16} aria-hidden="true" />Volver a administración</Link>
    </div>
    <AppShell navItems={[{ href: base, label: 'Mis clientes' }, { href: `${base}/fees`, label: 'Mis llamadas' }, { href: `${base}/unassigned`, label: 'Sin cliente' }]} roleLabel="Admin · Vista previa" userName={coach.full_name || coach.email} userEmail={coach.email} searchAction={base}>
      {children}
    </AppShell>
  </>;
}
