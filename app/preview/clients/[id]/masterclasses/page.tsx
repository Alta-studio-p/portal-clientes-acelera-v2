import { getPreviewClient } from '@/lib/data/client-preview';
import { listMasterclasses } from '@/lib/data/masterclasses';
import { MasterclassesView } from '@/components/masterclasses-view';

export default async function ClientMasterclassesPreview({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  await getPreviewClient(id);
  return <MasterclassesView classes={await listMasterclasses()} basePath={`/preview/clients/${id}/masterclasses`}/>;
}
