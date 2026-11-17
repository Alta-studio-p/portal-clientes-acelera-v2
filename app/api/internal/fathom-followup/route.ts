import {after} from 'next/server';
import {getSql} from '@/lib/db';
import {verifyFathomSignature} from '@/lib/coach-followup.mjs';
import {receiveCoachFollowup} from '@/lib/coach-followup-store.mjs';
import {dispatchSummaries} from '@/lib/claude-summary-store.mjs';

export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request) {
  const hook=new URL(request.url).searchParams.get('hook');
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(hook??''))return Response.json({error:'Unauthorized'},{status:401});
  const sql=getSql();
  const [config]=await sql`select source_key,signing_secret from private.fathom_followup_hooks where id=${hook}::uuid and active`;
  if(!config)return Response.json({error:'Unauthorized'},{status:401});
  const reader=request.body?.getReader();
  if(!reader)return Response.json({error:'Invalid body'},{status:400});
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();return Response.json({error:'Body too large'},{status:413});}chunks.push(value);}
  const raw=Buffer.concat(chunks).toString('utf8');
  if(!verifyFathomSignature(config.signing_secret,request.headers,raw))return Response.json({error:'Unauthorized'},{status:401});
  let payload;
  try{payload=JSON.parse(raw);}catch{return Response.json({error:'Invalid body'},{status:400});}
  try{
    const outcome=await receiveCoachFollowup(sql,config.source_key,request.headers.get('webhook-id'),payload);
    if(outcome.accepted)after(async()=>{try{await dispatchSummaries(sql);}catch{/* The hourly dispatcher recovers pending work. */}});
    return Response.json({ok:outcome.status===200},{status:outcome.status,headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Temporarily unavailable'},{status:503});}
}
