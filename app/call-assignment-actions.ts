'use server';

import { revalidatePath } from 'next/cache';
import { assignCallClient, reviewCallDisposition } from '@/lib/data/call-assignment';
import type { AssignmentState } from '@/lib/call-assignment';

export async function assignClientToCall(_previous: AssignmentState, form: FormData): Promise<AssignmentState> {
  let result: AssignmentState;
  try {
    result = await assignCallClient(String(form.get('callId') ?? ''), String(form.get('clientId') ?? ''));
  } catch (error) {
    // Authentication redirects must remain framework control flow.
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    return { error: 'No se pudo guardar la asignación. Intenta de nuevo.', success: false };
  }
  if (result.success) {
    revalidatePath('/admin', 'layout');
    revalidatePath('/coach', 'layout');
    revalidatePath('/portal', 'layout');
    revalidatePath('/preview/clients/[id]', 'page');
  }
  return result;
}

export async function changeCallDisposition(_previous:AssignmentState,form:FormData):Promise<AssignmentState> {
  let result:AssignmentState;
  try {result=await reviewCallDisposition(String(form.get('callId')??''),String(form.get('operation')??''),String(form.get('reason')??''));}
  catch(error) {
    if(error&&typeof error==='object'&&'digest' in error)throw error;
    return {error:'No se pudo guardar la revisión. Intenta de nuevo.',success:false};
  }
  if(result.success){revalidatePath('/admin','layout');revalidatePath('/coach','layout');revalidatePath('/preview/coaches/[id]','layout');}
  return result;
}
