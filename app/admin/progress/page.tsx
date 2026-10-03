import { PageHeader } from "@/components/ui";
import { getClientsList, getCoachesWithClients } from "@/lib/data/admin";
import { getCadenceStatus, getProgramProgress } from "@/lib/program-dates";
import { ProgressBoard, type ProgressClient } from "./progress-board";

function clientName(client: { full_name: string | null; email: string }) {
  return client.full_name || client.email;
}

function shortCoachName(coach: { full_name: string | null; email: string }) {
  const fullName = coach.full_name?.trim();
  return fullName ? fullName.split(/\s+/)[0] : coach.email;
}

export default async function AdminProgressPage() {
  // Todos los filtros son de presentación y viven en ProgressBoard. La consulta
  // sigue leyendo la misma fuente Neon que usaba la tabla anterior.
  const [allClients, coaches] = await Promise.all([getClientsList({}), getCoachesWithClients()]);

  const clients: ProgressClient[] = allClients.map((client) => {
    const cadence = getCadenceStatus({
      status: client.status,
      start_date: client.start_date,
      last_call_at: client.last_call_at,
    });
    const progress = getProgramProgress(client);
    const completed = progress !== null && progress.daysRemaining <= 0;
    const ending = !completed && progress !== null && progress.daysRemaining <= 15;
    const category: ProgressClient["category"] = completed
      ? "completed"
      : cadence.behind
        ? "attention"
        : ending
          ? "ending"
          : "in-progress";
    const reason = completed
      ? "Programa finalizado"
      : cadence.behind
        ? `Sin sesión hace ${cadence.daysSinceLastCall} días`
        : ending
          ? progress.daysRemaining === 0 ? "Finaliza hoy" : `Faltan ${progress.daysRemaining} días`
          : client.last_call_at
            ? "Seguimiento al día"
            : "Sin sesiones registradas";

    return {
      id: client.id,
      name: clientName(client),
      coachNames: client.coach_names,
      startDate: client.start_date,
      endDate: client.end_date,
      callCount: client.call_count,
      lastCallAt: client.last_call_at,
      calls: client.calls,
      nextSession: client.next_session,
      category,
      reason,
      daysRemaining: progress?.daysRemaining ?? null,
      daysSinceLastCall: cadence.daysSinceLastCall,
    };
  });

  const boardCoaches = coaches.map((coach) => ({
    id: coach.id,
    name: shortCoachName(coach),
    clientIds: coach.clients.map((client) => client.id),
  }));

  return (
    <div>
      <PageHeader
        title="Progreso de clientes"
        description="Prioriza la gestión diaria con sesiones, próximas citas y señales de atención."
      />
      <ProgressBoard clients={clients} coaches={boardCoaches} />
    </div>
  );
}
