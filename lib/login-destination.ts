import type { Profile } from '@/lib/supabase/types';

export function loginDestination(value: string | undefined, role: Profile['role']) {
  const home = role === 'admin' ? '/admin' : role === 'coach' ? '/coach' : '/portal';
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]|%2f|%5c/i.test(value)) return home;
  const url = new URL(value, 'https://portal.invalid');
  const path = url.pathname;
  return path === home || path.startsWith(home + '/') || (role === 'admin' && path.startsWith('/preview/')) ? path + url.search + url.hash : home;
}
