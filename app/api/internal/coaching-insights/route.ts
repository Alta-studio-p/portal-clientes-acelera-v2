import { timingSafeEqual } from 'node:crypto';
import { getSql } from '@/lib/db';
import { refreshInsightBatch } from '@/lib/coaching-insight-store.mjs';

export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:Request){
  const expected=process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  const actual=request.headers.get('authorization')??'';
  if(!expected||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return Response.json({error:'Unauthorized'},{status:401});
  try{
    return Response.json({ok:true,...await refreshInsightBatch(getSql())},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({ok:false,error:'Coaching insight refresh failed.'},{status:503});}
}
