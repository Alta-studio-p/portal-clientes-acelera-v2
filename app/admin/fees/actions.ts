'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { getSql } from '@/lib/db';
import { CALL_HOURLY_RATE, PAYMENT_TYPES } from '@/lib/coach-fees';

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
  const coachId = text('coachId');
  const clientId = text('clientId') || null;
  const topic = text('topic');
  const serviceDate = text('serviceDate');
  const paidOn = text('paidOn') || null;
  const paymentType = text('paymentType') || null;
  const hours = text('hours') ? Number(text('hours').replace(',', '.')) : callId ? 1 : null;
  const amount = text('amount') ? Number(text('amount').replace(',', '.')) : callId ? (hours ?? 1) * CALL_HOURLY_RATE : null;
  const fail = (error: string) => ({ error, success: false });

  if (![coachId, ...[id, callId, clientId].filter((v): v is string => v !== null)].every(v => uuid.test(v))) return fail('Identificador no válido.');
  if (!topic || topic.length > 500) return fail('Escribe un tema de hasta 500 caracteres.');
  if (!validDate(serviceDate) || (paidOn && !validDate(paidOn))) return fail('Revisa las fechas.');
  if (hours !== null && (!Number.isFinite(hours) || hours <= 0 || hours > 9999 || Math.abs(hours * 100 - Math.round(hours * 100)) > 0.00001)) return fail('Las horas deben ser mayores que cero, con máximo dos decimales.');
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 999999999999 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001)) return fail('Revisa el valor en pesos, con máximo dos decimales.');
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
      const [call] = await sql`select id from public.calls where id = ${callId}::uuid and coach_id = ${coachId}::uuid`;
      if (!call) return fail('La llamada no pertenece a este coach.');
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
