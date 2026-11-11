import { getPreviewClient } from '@/lib/data/client-preview';
import { listMasterclasses } from '@/lib/data/masterclasses';
import { MasterclassesView } from '@/components/masterclasses-view';

export default async function ClientMasterclassesPreview({params}:{params:Promise<{id:string}>}){
  await getPreviewClient((await params).id);
  return <MasterclassesView classes={await listMasterclasses()}/>;
}
