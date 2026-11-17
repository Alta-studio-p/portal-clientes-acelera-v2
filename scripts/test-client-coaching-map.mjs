import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeCoachingMapRead,clientCoachingBundle} from '../lib/client-coaching-map.mjs';
import {createSqlClient} from '../lib/postgres.mjs';

test('client projection hides private notes, dismissed suggestions and historical versions without mutating staff data',()=>{
  const bundle={topics:[{topic:'cv',state:'trabajado',note:'internal-topic'}],recommendations:[
    {recommendation_key:'dismissed',state:'dismissed',note:'internal-decision'},
    {recommendation_key:'edited',state:'edited',note:'Practicar el ejemplo acordado.'},
    {recommendation_key:'accepted',state:'accepted',note:'internal-note'},
  ],versions:[{id:'current',cost_usd:'0.001',analysis:{recommendations:[
    {key:'dismissed',action:'Outdated action'},
    {key:'edited',action:'Original suggestion'},
    {key:'accepted',action:'Accepted action'},
  ]}},{id:'old',analysis:{recommendations:[]}}]};
  const original=structuredClone(bundle),result=clientCoachingBundle(bundle);
  assert.deepEqual(bundle,original);
  assert.equal(result.versions.length,1);
  assert.equal(result.versions[0].cost_usd,null);
  assert.equal(result.versions[0].analysis.recommendations[0].action,'Practicar el ejemplo acordado.');
  assert.equal(result.versions[0].analysis.recommendations.length,2);
  assert.ok(!JSON.stringify(result).includes('internal-'));
  assert.equal(result.topics[0].state,'trabajado');
});

test('database read authorization isolates each client and assigned coach', {skip:!process.env.SUPABASE_DATABASE_URL},async()=>{
  const sql=createSqlClient();
  const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  try {
    await sql.transaction(async tx=>{
      await tx.query('create temporary table clients(id uuid,profile_id uuid) on commit drop');
      await tx.query('create temporary table coaches(id uuid,profile_id uuid) on commit drop');
      await tx.query('create temporary table coach_client_assignments(client_id uuid,coach_id uuid) on commit drop');
      await tx.query('insert into pg_temp.clients values($1,$2),($3,$4)',[id(1),id(11),id(2),id(12)]);
      await tx.query('insert into pg_temp.coaches values($1,$2)',[id(3),id(13)]);
      await tx.query('insert into pg_temp.coach_client_assignments values($1,$2)',[id(1),id(3)]);
      const db=(strings,...values)=>tx.query(strings.reduce((query,part,index)=>query+(index?`$${index}`:'')+part,'').replaceAll('public.','pg_temp.'),values);
      const session=(role,userId)=>({profile:{role},userId});
      await authorizeCoachingMapRead(db,session('client',id(11)),id(1));
      await assert.rejects(authorizeCoachingMapRead(db,session('client',id(11)),id(2)),/denied/);
      await authorizeCoachingMapRead(db,session('coach',id(13)),id(1));
      await assert.rejects(authorizeCoachingMapRead(db,session('coach',id(13)),id(2)),/denied/);
      await assert.rejects(authorizeCoachingMapRead(db,session('coach',id(14)),id(1)),/denied/);
      await authorizeCoachingMapRead(db,session('admin',id(14)),id(2));
      await assert.rejects(authorizeCoachingMapRead(db,session('client',id(11)),'invalid'),/denied/);
    });
  } finally {await sql.end();}
});
