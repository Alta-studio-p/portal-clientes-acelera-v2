import { redirect } from "next/navigation";

// La vista operativa única de clientes es Progreso. Conservamos esta ruta
// para enlaces existentes, pero evitamos duplicar la misma información.
export default function AdminClientsPage() {
  redirect("/admin/progress");
}
