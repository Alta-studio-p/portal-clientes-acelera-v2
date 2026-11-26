import { notFound } from 'next/navigation';
import { getPreviewClient } from '@/lib/data/client-preview';
import { getMasterclass } from '@/lib/data/masterclasses';
import { MasterclassDetail } from '@/components/masterclass-detail';

/** Vista previa admin: muestra exactamente lo que vería el cliente (sin permisos de admin). */
export default async function ClientMasterclassDetailPreview({params}:{params:Promise<{id:string;classId:string}>}){
  const {id,classId}=await params;
  await getPreviewClient(id);
  const item=await getMasterclass(classId);
  if(!item)notFound();
  return <MasterclassDetail item={item} backHref={`/preview/clients/${id}/masterclasses`}/>;
}
