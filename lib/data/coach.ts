import { createClient } from "@/lib/supabase/server";
import type { ClientStatus } from "@/lib/supabase/types";

export interface CoachClientRow {
  id: string;
  full_name: string | null;
  email: string;
  status: ClientStatus;
  is_primary: boolean;
  call_count: number;
  last_call_at: string | null;
}

export async function getClientsForCoach(coachId: string): Promise<CoachClientRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coach_client_assignments")
    .select(
      "is_primary, clients ( id, full_name, email, status, calls!calls_client_id_fkey ( id, started_at ) )"
    )
    .eq("coach_id", coachId);

  if (error || !data) return [];

  type Row = {
    is_primary: boolean;
    clients: {
      id: string;
      full_name: string | null;
      email: string;
      status: ClientStatus;
      calls: { id: string; started_at: string | null }[];
    } | null;
  };

  return (data as unknown as Row[])
    .filter((r) => r.clients)
    .map((r) => {
      const calls = r.clients!.calls ?? [];
      const lastCall = calls
        .filter((c) => c.started_at)
        .sort((a, b) => (b.started_at! > a.started_at! ? 1 : -1))[0];

      return {
        id: r.clients!.id,
        full_name: r.clients!.full_name,
        email: r.clients!.email,
        status: r.clients!.status,
        is_primary: r.is_primary,
        call_count: calls.length,
        last_call_at: lastCall?.started_at ?? null,
      };
    })
    .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));
}
