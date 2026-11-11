import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { getClientDetail } from '@/lib/data/client-detail';

export const getPreviewClient=cache(async(id:string)=>{
  const session=await requireRole(['admin']);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
  const client=await getClientDetail(id);
  if(!client)notFound();
  return {client,session};
});
