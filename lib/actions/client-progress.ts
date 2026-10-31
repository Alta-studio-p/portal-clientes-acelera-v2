'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { getSql } from '@/lib/db';
import { validProgressDate } from '@/lib/client-progress';

export interface ProgressState { error: string | null; success: boolean }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function refresh(clientId?: string) {
  for (const path of ['/admin/progress','/coach/progress','/admin/coaches','/coach','/portal']) revalidatePath(path);
  revalidatePath('/preview/coaches/[id]', 'layout');
  if (clientId) for (const path of [`/admin/clients/${clientId}`,`/coach/clients/${clientId}`,`/preview/clients/${clientId}`]) revalidatePath(path);
}

export async function editProgressLabel(clientId: string, operation: 'add' | 'remove' | 'create', value: string): Promise<ProgressState> {
  const session = await requireRole(['admin','coach']);
  if (!uuid.test(clientId) || !['add','remove','create'].includes(operation) || typeof value !== 'string') return {error:'Solicitud inválida.',success:false};
  const label = value.trim().replace(/\s+/g,' ');
  if (operation === 'create' ? !label || label.length > 60 : !uuid.test(value)) return {error:'Estado inválido. Usa un nombre de hasta 60 caracteres.',success:false};
  const sql = getSql();
  try {
    await sql.transaction(async tx => {
      const allowed = await tx`select c.id from public.clients c where c.id=${clientId}::uuid and
        (${session.profile.role === 'admin'} or exists (select 1 from public.coach_client_assignments a
          join public.coaches co on co.id=a.coach_id where a.client_id=c.id and co.profile_id=${session.userId}::uuid)) for update`;
      if (!allowed.length) throw new Error('denied');
      let categoryId = value;
      if (operation === 'create') {
        await tx`insert into public.client_progress_categories (label) values (${label}) on conflict do nothing`;
        const [category] = await tx`select id::text from public.client_progress_categories where lower(trim(label))=lower(${label}) and active=true for share`;
        if (!category) throw new Error('inactive');
        categoryId = String(category.id);
      }
      if (operation === 'remove') {
        await tx`delete from public.client_progress_labels where client_id=${clientId}::uuid and category_id=${categoryId}::uuid`;
        await tx`update public.client_progress_states set category_id=null,updated_by=${session.userId}::uuid,updated_at=now() where client_id=${clientId}::uuid and category_id=${categoryId}::uuid`;
      } else {
        const active = await tx`select id from public.client_progress_categories where id=${categoryId}::uuid and active=true for share`;
        if (!active.length) throw new Error('inactive');
        await tx`insert into public.client_progress_labels (client_id,category_id,updated_by) values
          (${clientId}::uuid,${categoryId}::uuid,${session.userId}::uuid) on conflict (client_id,category_id) do nothing`;
      }
    });
  } catch {return {error:'No se pudo guardar. Revisa tus permisos o si el estado fue retirado.',success:false};}
  refresh(clientId);
  return {error:null,success:true};
}

export async function saveProgressClient(_previous: ProgressState, form: FormData): Promise<ProgressState> {
  const session = await requireRole(['admin','coach']);
  const id = String(form.get('clientId') ?? '');
  const field = String(form.get('field') ?? '');
  const value = String(form.get('value') ?? '').trim();
  if (!uuid.test(id) || !['start','category','primary'].includes(field)) return { error: 'Cliente o campo inválido.', success: false };
  if (field === 'primary' && (session.profile.role !== 'admin' || !uuid.test(value))) return { error: 'Solo un administrador puede cambiar el coach principal.', success: false };
  if (field === 'start' && !validProgressDate(value)) return { error: 'Selecciona una fecha de inicio válida.', success: false };
  if (field === 'category' && value && !uuid.test(value)) return { error: 'Estado inválido.', success: false };
  const sql = getSql();
  try {
    // Check assignment inside the same transaction as the write, never trust a coach ID from the browser.
    await sql.transaction(async tx => {
      const rows = await tx`
        select c.id from public.clients c where c.id=${id}::uuid
          and (${session.profile.role === 'admin'} or exists (
            select 1 from public.coach_client_assignments a join public.coaches co on co.id=a.coach_id
            where a.client_id=c.id and co.profile_id=${session.userId}::uuid)) for update
      `;
      if (!rows.length) throw new Error('denied');
      if (field === 'start') {
        await tx`update public.clients set start_date=${value}::date, updated_at=now() where id=${id}::uuid`;
      } else if (field === 'primary') {
        const [coach] = await tx`select id, is_support_coach from public.coaches where id=${value}::uuid`;
        if (!coach) throw new Error('coach');
        // La coach de apoyo no puede ser principal de un cliente con coach de trabajo (la base descartaría el cambio y se perdería el principal actual).
        if (coach.is_support_coach) {
          const [working] = await tx`select 1 from public.coach_client_assignments a join public.coaches c on c.id=a.coach_id where a.client_id=${id}::uuid and not c.is_support_coach limit 1`;
          if (working) throw new Error('support');
        }
        await tx`update public.coach_client_assignments set is_primary=false where client_id=${id}::uuid and is_primary`;
        await tx`insert into public.coach_client_assignments (coach_id, client_id, is_primary) values (${value}::uuid, ${id}::uuid, true)
          on conflict (coach_id, client_id) do update set is_primary=true`;
      } else {
        if (value) {
          const category = await tx`select id from public.client_progress_categories where id=${value}::uuid and active=true for share`;
          if (!category.length) throw new Error('inactive');
        }
        await tx`insert into public.client_progress_states (client_id,category_id,updated_by)
          values (${id}::uuid,${value || null}::uuid,${session.userId}::uuid)
          on conflict (client_id) do update set category_id=excluded.category_id,updated_by=excluded.updated_by,updated_at=now()`;
      }
    });
  } catch {
    return { error: 'No se pudo guardar. Revisa tus permisos y que el estado siga disponible.', success: false };
  }
  refresh(id);
  return { error: null, success: true };
}

export async function manageProgressCategory(_previous: ProgressState, form: FormData): Promise<ProgressState> {
  await requireRole(['admin']);
  const id = String(form.get('id') ?? '');
  const action = String(form.get('operation') ?? '');
  const label = String(form.get('label') ?? '').trim().replace(/\s+/g,' ');
  if (!['add','rename','archive','restore'].includes(action) || (action !== 'add' && !uuid.test(id))) return { error: 'Operación inválida.', success: false };
  if (['add','rename'].includes(action) && (!label || label.length > 60)) return { error: 'Usa un nombre de 1 a 60 caracteres.', success: false };
  const sql = getSql();
  try {
    if (action === 'add') await sql`insert into public.client_progress_categories (label) values (${label})`;
    else if (action === 'rename') await sql`update public.client_progress_categories set label=${label} where id=${id}::uuid`;
    else await sql`update public.client_progress_categories set active=${action === 'restore'} where id=${id}::uuid`;
  } catch { return { error: 'No se pudo guardar. Puede que ya exista una categoría con ese nombre.', success: false }; }
  refresh();
  return { error: null, success: true };
}
