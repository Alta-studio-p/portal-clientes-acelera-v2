import 'server-only';
import { requireRole } from '@/lib/auth';
import { getSql } from '@/lib/db';
import type { AssignmentClient, AssignmentState, AttentionCall } from '@/lib/call-assignment';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCallAssignmentQueue(): Promise<{ calls: AttentionCall[]; discardedCalls: AttentionCall[]; clients: AssignmentClient[] }> {
  const { userId, profile } = await requireRole(['admin', 'coach']);
  const sql = getSql();
  const admin = profile.role === 'admin';
  const calls = await sql`
    select c.id::text, c.client_id::text, c.coach_id::text, c.title, c.display_title,
      c.started_at::text, c.summary, c.recording_url, c.share_url,
      coalesce(co.full_name, co.email) as coach_name, c.discarded_at::text, c.discard_reason
    from public.calls c
    left join public.coaches co on co.id = c.coach_id
    where (c.client_id is null or (${admin} and c.summary is null))
      and (${admin} or co.profile_id = ${userId}::uuid)
    order by c.started_at desc nulls last, c.id
  `;
  const clients = await sql`
    select cl.id::text, coalesce(cl.full_name, cl.email, 'Cliente') as name, cl.email
    from public.clients cl
    where ${admin} or exists (
      select 1 from public.coach_client_assignments a
      join public.coaches co on co.id = a.coach_id
      where a.client_id = cl.id and co.profile_id = ${userId}::uuid
    )
    order by coalesce(cl.full_name, cl.email), cl.id
  `;
  const rows=calls as unknown as AttentionCall[];
  return { calls: rows.filter(call=>!call.discarded_at), discardedCalls:rows.filter(call=>call.discarded_at), clients: clients as unknown as AssignmentClient[] };
}

export async function assignCallClient(callId: string, clientId: string): Promise<AssignmentState> {
  const { userId, profile } = await requireRole(['admin', 'coach']);
  const fail = (error: string): AssignmentState => ({ error, success: false });
  if (!uuid.test(callId) || !uuid.test(clientId)) return fail('Selecciona una llamada y un cliente válidos.');
  const sql = getSql();
  return sql.transaction(async tx => {
    // Lock before checking the current assignment so concurrent requests cannot replace it.
    const [call] = await tx`
      select c.id, c.client_id::text, c.coach_id::text, c.discarded_at, co.profile_id::text as coach_profile_id
      from public.calls c left join public.coaches co on co.id = c.coach_id
      where c.id = ${callId}::uuid for update of c
    `;
    if (!call || (profile.role === 'coach' && call.coach_profile_id !== userId)) return fail('No tienes acceso a esta llamada.');
    if (call.discarded_at) return fail('Restaura la llamada antes de asignar un cliente.');
    const [client] = await tx`
      select cl.id from public.clients cl where cl.id = ${clientId}::uuid and (
        ${profile.role === 'admin'} or exists (
          select 1 from public.coach_client_assignments a
          where a.client_id = cl.id and a.coach_id = ${call.coach_id}::uuid
        )
      )
    `;
    if (!client) return fail('El cliente no está disponible para esta asignación.');
    if (call.client_id) return call.client_id === clientId
      ? { error: null, success: true }
      : fail('Esta llamada ya tiene cliente. Recarga la página para ver la asignación actual.');
    const [conflict] = await tx`select id from public.coach_fees where call_id = ${callId}::uuid and client_id is not null and client_id <> ${clientId}::uuid`;
    if (conflict) return fail('Esta llamada tiene un registro de pago de otro cliente. Debe revisarlo un administrador.');
    const audit = JSON.stringify({ client_match_reason: 'manual_assignment', client_assignment: { user_id: userId, role: profile.role, assigned_at: new Date().toISOString(), previous_client_id: null } });
    await tx`
      update public.calls set client_id = ${clientId}::uuid,
        raw_metadata = coalesce(raw_metadata, '{}'::jsonb) || ${audit}::jsonb
      where id = ${callId}::uuid and client_id is null
    `;
    if (call.coach_id) await tx`
      insert into public.coach_client_assignments (coach_id, client_id, is_primary)
      values (${call.coach_id}::uuid, ${clientId}::uuid, false)
      on conflict (coach_id, client_id) do nothing
    `;
    await tx`update public.coach_fees set client_id = ${clientId}::uuid where call_id = ${callId}::uuid and client_id is null`;
    return { error: null, success: true };
  });
}

export async function reviewCallDisposition(callId:string,operation:string,reason:string):Promise<AssignmentState> {
  const {userId,profile}=await requireRole(['admin','coach']);
  const fail=(error:string):AssignmentState=>({error,success:false});
  if(!uuid.test(callId)||!['discard','restore'].includes(operation))return fail('Selecciona una llamada válida.');
  if(operation==='discard'&&!['no_show','internal','unrelated'].includes(reason))return fail('Selecciona el motivo para descartar.');
  return getSql().transaction(async tx=>{
    const [call]=await tx`select c.id,c.client_id,c.discarded_at,co.profile_id::text as coach_profile_id
      from public.calls c left join public.coaches co on co.id=c.coach_id where c.id=${callId}::uuid for update of c`;
    if(!call||(profile.role==='coach'&&call.coach_profile_id!==userId))return fail('No tienes acceso a esta llamada.');
    if(call.client_id)return fail('Esta llamada ya tiene cliente. Debe revisarla un administrador antes de descartarla.');
    if(operation==='discard') {
      if(call.discarded_at)return {error:null,success:true};
      const [fee]=await tx`select id from public.coach_fees where call_id=${callId}::uuid limit 1`;
      if(fee)return fail('Esta llamada tiene honorarios guardados. Un administrador debe revisarlos antes de descartarla.');
      await tx`update public.calls set discarded_at=now(),discard_reason=${reason},discarded_by=${userId}::uuid where id=${callId}::uuid`;
    } else {
      if(!call.discarded_at)return {error:null,success:true};
      await tx`update public.calls set discarded_at=null,discard_reason=null,discarded_by=null where id=${callId}::uuid`;
    }
    await tx`insert into private.call_review_events(call_id,action,reason,actor_id,actor_role)
      values(${callId}::uuid,${operation},${operation==='discard'?reason:null},${userId}::uuid,${profile.role})`;
    return {error:null,success:true};
  });
}
