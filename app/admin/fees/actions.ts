'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { getSql } from '@/lib/db';
import { CALL_HOURLY_RATE, MAX_FEE_AMOUNT, MAX_FEE_HOURS, PAYMENT_TYPES } from '@/lib/coach-fees';
import { emailToLearn } from '@/lib/client-matching.mjs';

export interface FeeState { error: string | null; success: boolean }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validDate(value: string) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export async function saveFee(_previous: FeeState, form: FormData): Promise<FeeState> {
  const { userId } = await requireRole(['admin']);
  const text = (key: string) => String(form.get(key) ?? '').trim();
  const id = text('id') || null;
  const callId = text('callId') || null;
  let coachId = text('coachId');
  const callCoachId = text('callCoachId') || null;
  const clientId = text('clientId') || null;
  const topic = text('topic');
  const serviceDate = text('serviceDate');
  const paidOn = text('paidOn') || null;
  const paymentType = text('paymentType') || null;
  const hours = text('hours') ? Number(text('hours').replace(',', '.')) : callId ? 1 : null;
  const amount = text('amount') ? Number(text('amount').replace(',', '.')) : callId ? (hours ?? 1) * CALL_HOURLY_RATE : null;
  const fail = (error: string) => ({ error, success: false });

  if (![coachId, ...[id, callId, clientId, callCoachId].filter((v): v is string => v !== null)].every(v => uuid.test(v))) return fail('Identificador no válido.');
  if (!topic || topic.length > 500) return fail('Escribe un tema de hasta 500 caracteres.');
  if (!validDate(serviceDate) || (paidOn && !validDate(paidOn))) return fail('Revisa las fechas.');
  if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > MAX_FEE_HOURS || Math.abs(hours * 100 - Math.round(hours * 100)) > 0.00001)) return fail('Las horas deben ser mayores que cero y máximo 2 (COP $200.000), con máximo dos decimales.');
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > MAX_FEE_AMOUNT || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001)) return fail('Revisa el valor en pesos: máximo COP $200.000, con máximo dos decimales.');
  if (paymentType && !PAYMENT_TYPES.some(p => p.value === paymentType)) return fail('Selecciona un tipo de pago válido.');
  if (paidOn && (amount === null || !paymentType)) return fail('Para registrar un pago, completa el valor y el tipo de pago.');

  const sql = getSql();
  try {
    const [coach] = await sql`select id from public.coaches where id = ${coachId}::uuid`;
    if (!coach) return fail('No se encontró el coach.');
    if (clientId) {
      const [client] = await sql`select id from public.clients where id = ${clientId}::uuid`;
      if (!client) return fail('No se encontró el cliente.');
    }
    if (callId) {
      const [call] = await sql`select id, client_id::text, raw_metadata from public.calls where id = ${callId}::uuid and coach_id = ${coachId}::uuid`;
      if (!call) return fail('La llamada no pertenece a este coach.');
      // La llamada es del coach que la hizo: corregirlo mueve la llamada y su honorario a su hoja.
      if (callCoachId && callCoachId !== coachId) {
        const [target] = await sql`select id from public.coaches where id = ${callCoachId}::uuid`;
        if (!target) return fail('No se encontró el coach de la llamada.');
        await sql.transaction(async tx => {
          await tx`update public.calls set coach_id = ${callCoachId}::uuid, coach_resolution = 'manual', coach_needs_confirmation = false where id = ${callId}::uuid`;
          await tx`update public.coach_fees set coach_id = ${callCoachId}::uuid where call_id = ${callId}::uuid`;
        });
        coachId = callCoachId;
      } else if (callCoachId) {
        await sql`update public.calls set coach_resolution = 'manual', coach_needs_confirmation = false where id = ${callId}::uuid and coach_needs_confirmation`;
      }
      // Vínculo manual de una llamada sin cliente: se guarda también el email del invitado como alterno.
      if (clientId && !call.client_id) {
        const audit = JSON.stringify({ client_match_reason: 'manual_assignment', client_assignment: { user_id: userId, role: 'admin', assigned_at: new Date().toISOString(), previous_client_id: null } });
        await sql`
          update public.calls set client_id = ${clientId}::uuid, client_match_method = 'manual',
            raw_metadata = coalesce(raw_metadata, '{}'::jsonb) || ${audit}::jsonb
          where id = ${callId}::uuid and client_id is null
        `;
        await sql`
          insert into public.coach_client_assignments (coach_id, client_id, is_primary)
          values (${coachId}::uuid, ${clientId}::uuid, false) on conflict (coach_id, client_id) do nothing
        `;
        const known = await sql`select email, alternate_emails from public.clients`;
        const invitees = (call.raw_metadata as { external_invitees?: { email?: string }[] } | null)?.external_invitees ?? [];
        const learn = emailToLearn(invitees, known as unknown as { email: string | null; alternate_emails: string[] | null }[]);
        if (learn) await sql`update public.clients set alternate_emails = array_append(alternate_emails, ${learn}) where id = ${clientId}::uuid and not (${learn} = any(alternate_emails))`;
      }
    }
    if (id) {
      const updated = await sql`
        update public.coach_fees set client_id = ${clientId}::uuid, service_date = ${serviceDate}::date,
          topic = ${topic}, hours = ${hours}, amount = ${amount}, payment_type = ${paymentType},
          paid_on = ${paidOn}::date, updated_by = ${userId}::uuid, updated_at = now()
        where id = ${id}::uuid and coach_id = ${coachId}::uuid and call_id is not distinct from ${callId}::uuid
        returning id
      `;
      if (!updated.length) return fail('No se encontró el registro. Recarga la página.');
    } else {
      await sql`
        insert into public.coach_fees (coach_id, call_id, client_id, service_date, topic, hours, amount, payment_type, paid_on, updated_by)
        values (${coachId}::uuid, ${callId}::uuid, ${clientId}::uuid, ${serviceDate}::date, ${topic}, ${hours}, ${amount}, ${paymentType}, ${paidOn}::date, ${userId}::uuid)
        on conflict (call_id) do update set client_id = excluded.client_id, service_date = excluded.service_date,
          topic = excluded.topic, hours = excluded.hours, amount = excluded.amount, payment_type = excluded.payment_type,
          paid_on = excluded.paid_on, updated_by = excluded.updated_by, updated_at = now()
        where coach_fees.coach_id = excluded.coach_id
      `;
    }
  } catch {
    return fail('No se pudo guardar. Intenta de nuevo.');
  }
  revalidatePath('/admin/fees');
  return { error: null, success: true };
}
