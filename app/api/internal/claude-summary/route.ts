import {getSql} from '@/lib/db';
import {secretMatches} from '@/lib/claude-summary.mjs';
import {authorizeSummaryJob,summaryPayload,dispatchSummaries,completeSummaryJob,startSummaryJob} from '@/lib/claude-summary-store.mjs';

export const runtime='nodejs';
export const maxDuration=120;
const headers={'Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
function cron(request:Request) {
  return !!process.env.CRON_SECRET && secretMatches(request.headers.get('authorization')||'',`Bearer ${process.env.CRON_SECRET}`);
}
export async function GET(request:Request) {
  const id=new URL(request.url).searchParams.get('job');
  if (!id) {
    if (!cron(request)) return reply({error:'Unauthorized'},401);
    try {return reply({ok:true,...await dispatchSummaries(getSql())});} catch {return reply({error:'Dispatch unavailable'},503);}
  }
  const job=await authorizeSummaryJob(getSql(),id,request.headers.get('authorization')||'');
  if (!job) return reply({error:'Unauthorized'},401);
  if (!['starting','running','uncertain'].includes(job.status)) return reply({error:'Job unavailable'},409);
  return reply(summaryPayload(job));
}
export async function POST(request:Request) {
  const id=new URL(request.url).searchParams.get('job');
  if (!id) {
    if (!cron(request)) return reply({error:'Unauthorized'},401);
    try {return reply({ok:true,...await dispatchSummaries(getSql())});} catch {return reply({error:'Dispatch unavailable'},503);}
  }
  const authorization=request.headers.get('authorization')||'';
  const job=await authorizeSummaryJob(getSql(),id,authorization);
  if (!job) return reply({error:'Unauthorized'},401);
  let body;
  try {
    // Bound the streamed body as well as Content-Length, which callers can omit.
    const reader=request.body?.getReader();
    if (!reader) return reply({error:'Invalid body'},400);
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>600000){await reader.cancel();return reply({error:'Body too large'},413);}chunks.push(value);}
    body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {return reply({error:'Invalid body'},400);}
  if (body?.action==='start' && job.fixture && job.status==='pending') {
    try {return reply({ok:true,...await startSummaryJob(getSql(),id,{fixture:true})});} catch {return reply({error:'Dispatch unavailable'},503);}
  }
  try {
    const result=await completeSummaryJob(getSql(),id,authorization,body?.result);
    return reply(result.status===200?{ok:true}:{error:'Result rejected'},result.status);
  } catch {return reply({error:'Result unavailable'},503);}
}
