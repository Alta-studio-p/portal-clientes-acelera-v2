import { MasterclassesView } from "@/components/masterclasses-view";
import { requireRole } from "@/lib/auth";
import { listMasterclasses } from "@/lib/data/masterclasses";

export default async function MasterclassesPage() {
  await requireRole(["client"]);
  return <MasterclassesView classes={await listMasterclasses()} />;
}
