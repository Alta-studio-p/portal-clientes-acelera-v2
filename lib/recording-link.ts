import { safeRecordingUrl } from '@/lib/coach-fees';

/**
 * Único link de grabación que se muestra en el portal: el de compartir de Fathom (fathom.video/share/…),
 * que cualquiera abre sin iniciar sesión. El link interno (fathom.video/calls/…) pide "Request access"
 * y no se usa nunca, ni siquiera como respaldo.
 */
export function publicRecordingUrl(call: { share_url?: string | null }): string | null {
  const url = call.share_url?.trim();
  if (!url || !safeRecordingUrl(url)) return null;
  const { hostname, pathname } = new URL(url);
  return /(^|\.)fathom\.video$/i.test(hostname) && pathname.startsWith('/share/') ? url : null;
}
