import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import ts from 'typescript';

async function load(path, name, mocks) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
    .replace(/^import .*;\n/gm, '').replaceAll('export async function','async function');
  return new Function(...Object.keys(mocks),`${compiled};return ${name};`)(...Object.values(mocks));
}
process.env.SUPABASE_SECRET_KEY='test-only-secret';
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const form = entries => {const f=new FormData(); for(const [k,v] of Object.entries(entries))f.set(k,v);return f;};
let blocked=false;
const sent=[];
const recover=await load('../app/login/forgot-password/actions.ts','forgotPasswordAction',{
  createHmac,headers:async()=>new Headers(),getSql:()=>async()=>[{key:'test',attempts:blocked?100:1}],
  getActivationUrl:async safe=>{assert.equal(safe,true);return 'https://example.test/auth/activate';},
  createAdminClient:async()=>({auth:{resetPasswordForEmail:async(email,options)=>{sent.push({email,options});return {error:null};}}}),
});
const initial={error:null,message:null};
const result=await recover(initial,form({email:' Client@Example.Test '}));
assert.equal(sent[0].email,'client@example.test');
assert.equal(sent[0].options.redirectTo,'https://example.test/auth/activate');
assert.ok(result.message);
await recover(initial,form({email:'ross'}));
assert.equal(sent[1].email,'ross@joinaceleratalent.com');
blocked=true;
assert.deepEqual(await recover(initial,form({email:'client@example.test'})),result);
assert.equal(sent.length,2);
assert.ok((await recover(initial,form({email:'bad@'}))).error);

let role='client',linked=true,updates=0;
const setPassword=await load('../app/auth/activate/actions.ts','setNewPassword',{
  requireProfile:async()=>({userId:'test-id',profile:{role}}),
  getClientByProfileId:async()=>linked?{}:null,
  roleHome:r=>({admin:'/admin',coach:'/coach',client:'/portal'})[r],
  createClient:async()=>({auth:{updateUser:async()=>{updates++;return {error:null};}}}),
  redirect:target=>{throw new Error(`redirect:${target}`);},
});
for(const r of ['client','coach','admin']) {
  role=r;
  await assert.rejects(setPassword({error:null},form({password:'test-password-123',confirmPassword:'test-password-123'})),new RegExp(`redirect:${({client:'/portal',coach:'/coach',admin:'/admin'})[r]}`));
}
assert.equal(updates,3);
role='client';linked=false;
assert.ok((await setPassword({error:null},form({password:'test-password-123',confirmPassword:'test-password-123'}))).error);
linked=true;
assert.ok((await setPassword({error:null},form({password:'short',confirmPassword:'short'}))).error);
assert.ok((await setPassword({error:null},form({password:'test-password-123',confirmPassword:'different'}))).error);
assert.equal(updates,3);
console.log('PASS: recovery email normalization, safe redirect, rate limit, validation, client binding and all role destinations. No real emails or password changes.');
