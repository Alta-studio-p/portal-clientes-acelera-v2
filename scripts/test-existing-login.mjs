import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

async function load(path, name, mocks={}) {
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
    .replace(/^import .*;\n/gm,'').replaceAll('export async function','async function').replaceAll('export function','function');
  return new Function(...Object.keys(mocks),`${code};return ${name};`)(...Object.values(mocks));
}
const destination=await load('../lib/login-destination.ts','loginDestination');
for(const value of ['/admin','/login','/logout','/register','//example.com','/\\example.com','/portal/../admin']) {
  assert.equal(destination(value,'client'),'/portal');
}
assert.equal(destination('/portal?call=123','client'),'/portal?call=123');
assert.equal(destination('/coach/fees','coach'),'/coach/fees');
assert.equal(destination('/admin/progress','admin'),'/admin/progress');
let role='client',profile=true,confirmed=true,authError=null,emailSeen='',signedOut=0;
const login=await load('../app/login/actions.ts','loginAction',{
  loginDestination:destination,
  getSql:()=>async()=>profile?[{id:'test-id',role}]:[],
  createClient:async()=>({auth:{signInWithPassword:async({email})=>{emailSeen=email;return {data:{user:{id:'test-id',email_confirmed_at:confirmed?'2026-10-01':null}},error:authError};},signOut:async options=>{assert.equal(options.scope,'local');signedOut++;}}}),
  redirect:path=>{throw Error('redirect:'+path);},
});
const form=new FormData();form.set('email',' Client@Example.Test ');form.set('password','unchanged-password');form.set('redirectTo','/admin');
await assert.rejects(login({error:null},form),/redirect:\/portal/);
assert.equal(emailSeen,'client@example.test');
role='coach';await assert.rejects(login({error:null},form),/redirect:\/coach/);
profile=false;assert.ok((await login({error:null},form)).error);assert.equal(signedOut,1);
profile=true;confirmed=false;assert.match((await login({error:null},form)).error,/Olvidé/);
confirmed=true;authError={code:'email_not_confirmed'};assert.match((await login({error:null},form)).error,/Olvidé/);
authError={status:429};assert.match((await login({error:null},form)).error,/Demasiados/);
authError={status:503};assert.match((await login({error:null},form)).error,/servicio/);

let user=null;
function response(kind,url) {const values=[];return {kind,url,cookies:{set:(...args)=>values.push(args.length===1?args[0]:{name:args[0],value:args[1],...args[2]}),getAll:()=>values}};}
const middleware=await load('../lib/supabase/middleware.ts','updateSession',{
  NextResponse:{next:()=>response('next'),redirect:url=>response('redirect',url)},
  createServerClient:(_url,_key,options)=>({auth:{getUser:async()=>{options.cookies.setAll([{name:'session',value:'refreshed',options:{httpOnly:true}}]);return {data:{user}};}}}),
});
function request(path){const url=new URL('https://example.test'+path);url.clone=()=>new URL(url);return {nextUrl:url,cookies:{getAll:()=>[],set:()=>{}}};}
let result=await middleware(request('/portal'));
assert.equal(result.kind,'redirect');assert.equal(result.url.pathname,'/login');assert.equal(result.cookies.getAll()[0].value,'refreshed');assert.equal(result.cookies.getAll()[0].httpOnly,true);
user={id:'test-id',email_confirmed_at:'2026-10-01'};
for(const path of ['/login','/login/forgot-password','/register'])assert.equal((await middleware(request(path))).kind,'next');
user={id:'test-id',email_confirmed_at:null};
assert.equal((await middleware(request('/login'))).kind,'next');
assert.equal((await middleware(request('/portal'))).kind,'redirect');
console.log('PASS: existing-account login, email normalization, role-aware redirects, missing-profile cleanup, pending invitation guidance, refresh cookies and recovery access with an active session. No password changes.');
