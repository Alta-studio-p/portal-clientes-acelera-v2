import assert from 'node:assert/strict';
import {classificationInput,classificationResult,automaticNoShow,classificationTranscript,classificationHash} from '../lib/call-classification.mjs';
import {completeClassification} from '../lib/call-classification-store.mjs';

const input=classificationInput({title:'Sesion',summary:'El cliente no se conectó a esta sesión.',duration_seconds:600,raw_metadata:{speaker_summary:{external:0}}});
const result={category:'no_show',confidence:0.99,reason:'Ausencia explícita.',evidence:[{field:'summary',quote:input.summary}],class_title:null,class_description:null};
assert.equal(classificationResult(input,result),result);
assert.equal(automaticNoShow(input,result),true);
assert.equal(automaticNoShow({...input,external_speakers:null},result),false);
assert.equal(automaticNoShow({...input,external_speakers:1},result),false);
assert.equal(automaticNoShow(input,{...result,confidence:0.9}),false);
assert.equal(automaticNoShow(input,{...result,evidence:[{field:'title',quote:input.summary}]}),false);
assert.throws(()=>classificationResult(input,{...result,evidence:[{field:'summary',quote:'Inventado no se conectó'}]}));
assert.throws(()=>classificationResult(input,{...result,category:'caro_class',class_title:'Clase',class_description:'Grupal'}));
assert.deepEqual(await classificationTranscript('https://evil.example/share/x',{fetchImpl:()=>{throw Error('must not fetch');}}),{});
assert.deepEqual(await classificationTranscript('https://fathom.video/share/x',{fetchImpl:async()=>({ok:false})}),{});

function mock(call,{fee=false}={}){
  const writes=[];
  const tx=async(strings,...values)=>{
    const query=strings.join('?');
    if(query.includes('select c.*'))return call?[call]:[];
    if(query.includes('select id from public.coach_fees'))return fee?[{id:'fee'}]:[];
    writes.push({query,values});return [];
  };
  return {tx,writes};
}
const call={id:'call',title:'Sesion',summary:input.summary,duration_seconds:600,client_id:'client',coach_id:'coach',share_url:'https://fathom.video/share/example',coach_is_caro:false,started_at:'2026-11-01'};
const job={id:'job',call_id:call.id,source_hash:classificationHash(call),snapshot:{input}};
let test=mock(call);
assert.equal((await completeClassification(test.tx,job,result)).status,200);
assert(test.writes.some(w=>w.query.includes('set discarded_at=now()')));
assert(!test.writes.some(w=>w.query.includes('client_id=')));
test=mock(call,{fee:true});await completeClassification(test.tx,job,result);
assert(!test.writes.some(w=>w.query.includes('set discarded_at=now()')));
test=mock({...call,classification_override_at:'2026-11-01'});
assert.equal((await completeClassification(test.tx,job,result)).status,409);
assert.equal(test.writes.length,1);
test=mock(call);await completeClassification(test.tx,{...job,fixture:true},result);
assert.equal(test.writes.length,1);assert(test.writes[0].query.includes('claude_summary_jobs'));
const groupCall={...call,coach_is_caro:true};
const groupResult={...result,category:'caro_class',class_title:'Clase de entrevistas',class_description:'Práctica grupal.'};
test=mock(groupCall);await completeClassification(test.tx,{...job,source_hash:classificationHash(groupCall),snapshot:{input:{...input,coach_is_caro:true}}},groupResult);
const draft=test.writes.find(w=>w.query.includes('insert into public.masterclasses'));
assert(draft);assert(draft.query.includes("'draft'"));assert(draft.query.includes('on conflict(source_call_id) do nothing'));
console.log('Classification: evidence, uncertainty, no-show safeguards, manual override, fees, fixtures and draft-only publication passed.');
