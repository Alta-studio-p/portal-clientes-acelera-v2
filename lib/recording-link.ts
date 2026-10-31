import { safeRecordingUrl } from '@/lib/coach-fees';

/** Link público de compartir de Fathom (se abre sin iniciar sesión). El `recording_url` interno exige login y no se usa. */
export function publicRecordingUrl(call: { share_url?: string | null }): string | null {
  const url = call.share_url?.trim();
  return url && safeRecordingUrl(url) ? url : null;
}
