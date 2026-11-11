import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { resolveClientContact, visibleClientEmail } from '../lib/client-contact.mjs';
import { clientWorkspaceShowsCalls } from '../lib/client-workspace.mjs';

test('calls are the default; map requires explicit selection',()=>{
  for(const section of [undefined,'','calls','unknown'])assert.equal(clientWorkspaceShowsCalls(section),true);
  assert.equal(clientWorkspaceShowsCalls('map'),false);
  assert.equal(clientWorkspaceShowsCalls('map','specific-call'),true);
});
test('linked account email wins without altering the stored contact',()=>{
  const client={email:'contact@example.com'};
  const result=resolveClientContact(client,{account_email:'  LOGIN@Example.com ',profile_email:'old@example.com',onboarding_email:'onboard@example.com'});
  assert.equal(result.display_email,'login@example.com');
  assert.equal(result.registration_email,'login@example.com');
  assert.equal(client.email,'contact@example.com');
});
test('onboarding provides a display fallback, not a new account or association',()=>{
  assert.deepEqual(resolveClientContact({email:null},{onboarding_email:'new@example.com'}),{display_email:'new@example.com',registration_email:null,email_source:'onboarding'});
  assert.equal(resolveClientContact({email:'not an email'}).display_email,null);
  assert.equal(visibleClientEmail({email:'contact@example.com',display_email:null}),null);
  assert.equal(visibleClientEmail({email:'contact@example.com'}),'contact@example.com');
});
test('preview masterclasses retain admin-only authorization and the client catalogue',async()=>{
  const guard=await fs.readFile(new URL('../lib/data/client-preview.ts',import.meta.url),'utf8');
  assert.match(guard,/requireRole\(\['admin'\]\)/);
  for(const file of ['../app/preview/clients/[id]/layout.tsx','../app/preview/clients/[id]/page.tsx','../app/preview/clients/[id]/masterclasses/page.tsx']){
    assert.match(await fs.readFile(new URL(file,import.meta.url),'utf8'),/await getPreviewClient\(/);
  }
  const page=await fs.readFile(new URL('../app/preview/clients/[id]/masterclasses/page.tsx',import.meta.url),'utf8');
  assert.match(page,/listMasterclasses\(\)/);assert.ok(!page.includes('listMasterclasses(true)'));
  const contacts=await fs.readFile(new URL('../lib/data/client-contacts.ts',import.meta.url),'utf8');
  assert.match(contacts,/p\.id=c\.profile_id and p\.role='client'/);
  assert.match(contacts,/u\.id=p\.id/);
  assert.ok(!contacts.includes('call_participants'));
});
