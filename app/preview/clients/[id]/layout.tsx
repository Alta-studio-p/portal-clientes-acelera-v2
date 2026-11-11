import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { getPreviewClient } from '@/lib/data/client-preview';
import { AppShell } from '@/components/app-shell';

export default async function ClientPreviewLayout({params,children}:{params:Promise<{id:string}>;children:ReactNode}){
  const {id}=await params;
  const {session:{profile,email}}=await getPreviewClient(id);
  const base=`/preview/clients/${id}`;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-accent-soft px-4 py-2 md:px-8">
      <p className="inline-flex items-center gap-2 text-sm font-medium text-accent"><Eye size={16} aria-hidden="true"/>Vista previa como cliente</p>
      <Link href={`/admin/clients/${id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline"><ArrowLeft size={16} aria-hidden="true"/>Volver a administración</Link>
    </div>
    <AppShell navItems={[{href:base,label:'Mi progreso'},{href:`${base}/masterclasses`,label:'Masterclases'}]} roleLabel="Admin · Vista previa" userName={profile.full_name||email} userEmail={email}>{children}</AppShell>
  </>;
}
