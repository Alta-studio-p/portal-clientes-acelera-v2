import 'server-only';
import { getSql } from '@/lib/db';
import { resolveClientContact } from '@/lib/client-contact.mjs';

export interface ClientContactFields {
  display_email?: string | null;
  registration_email?: string | null;
  email_source?: string | null;
}

// Only explicitly linked identities are used; never match an account by name
// or use an arbitrary meeting participant's email as a client's login address.
export async function withClientContacts<T extends {id:string;email?:string|null}>(clients:T[]):Promise<(T&ClientContactFields)[]> {
  if(!clients.length)return [];
  const identities=await getSql()`select c.id::text,u.email as account_email,p.email as profile_email,c.onboarding_email
    from public.clients c
    left join public.profiles p on p.id=c.profile_id and p.role='client'
    left join auth.users u on u.id=p.id
    where c.id=any(${clients.map(client=>client.id)}::uuid[])`;
  const byId=new Map(identities.map(identity=>[String(identity.id),identity]));
  return clients.map(client=>({...client,...resolveClientContact(client,byId.get(client.id)??{})}));
}
