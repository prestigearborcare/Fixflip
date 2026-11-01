import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createService, SINGLE_PRICE, MONTHLY_PRICE } from '../lib/service.mjs';
function fixture(options={}){
  const data=new Map();let version=0,emails=0,aiCalls=0;
  const store={async get(k){return structuredClone(data.get(k)?.data||null);},async getWithMetadata(k){return structuredClone(data.get(k)||null);},async setJSON(k,value,cond){const old=data.get(k);if(cond.onlyIfNew&&old||cond.onlyIfMatch&&old?.etag!==cond.onlyIfMatch)return {modified:false};data.set(k,{data:structuredClone(value),etag:String(++version)});return {modified:true};}};
  const env={STRIPE_SECRET_KEY:'fake_test_fixture',OPENAI_API_KEY:'fake_test_fixture',FIXFLIP_LIVE:'true',ESCALATION_EMAIL_READY:'true',...options.env};
  const reply=options.reply||{answer:'Check the accessible filter with the device off.',escalate:false,reason:''};
  const fetcher=async(url,init)=>{
    if(url.includes('/line_items'))return Response.json({data:[{price:{id:options.monthly?MONTHLY_PRICE:SINGLE_PRICE}}]});
    if(url.includes('/checkout/sessions/'))return Response.json({livemode:true,status:'complete',payment_status:options.unpaid?'unpaid':'paid',customer_details:{email:'customer@example.test'},subscription:'sub_fixture',payment_intent:'pi_fixture'});
    if(url.includes('/subscriptions/'))return Response.json({id:'sub_fixture',status:options.inactive?'past_due':'active',current_period_start:1000,current_period_end:9999999999,items:{data:[{price:{id:MONTHLY_PRICE}}]}});
    if(url.includes('/payment_intents/'))return Response.json({status:'succeeded',latest_charge:{refunded:!!options.refunded,amount_refunded:0}});
    if(url.endsWith('/responses')){aiCalls++;return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(reply)}]}]});}
    if(url.endsWith('/escalation-received.html')){emails++;return new Response(null,{status:options.emailFailure?500:303,headers:{Location:'/escalation-received.html'}});}
    throw Error('Unexpected outbound request');
  };
  const handle=createService({store,env,fetcher});let cookie='';
  async function req(action,body){const r=await handle(new Request('https://example.test/api/'+action,{method:body?'POST':'GET',headers:{origin:'https://example.test','content-type':'application/json',cookie},body:body?JSON.stringify(body):undefined}));if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};}
  return {req,handle,data,counts:()=>({emails,aiCalls})};
}
const login=f=>f.req('session',{session_id:'cs_live_fixture'});
test('setup fails closed and never calls providers',async()=>{const f=fixture({env:{FIXFLIP_LIVE:'false'}});assert.equal((await f.req('status')).data.ready,false);assert.equal((await login(f)).status,503);assert.deepEqual(f.counts(),{emails:0,aiCalls:0});});
test('unpaid and refunded checkouts cannot open a workspace',async()=>{for(const options of [{unpaid:true},{refunded:true}]){const f=fixture(options);assert.equal((await login(f)).status,403);}});
test('an inactive subscription cannot open a workspace',async()=>{const f=fixture({monthly:true,inactive:true});assert.equal((await login(f)).status,403);});
test('single purchase allows only one project including concurrent creates',async()=>{const f=fixture();await login(f);const results=await Promise.all(Array.from({length:4},(_,i)=>f.req('project',{title:'Repair issue '+i})));assert.equal(results.filter(r=>r.status===200).length,1);assert.equal((await f.req('projects')).data.used,1);});
test('monthly allowance is enforced on server',async()=>{const f=fixture({monthly:true});await login(f);for(let i=0;i<5;i++)assert.equal((await f.req('project',{title:'Repair project '+i})).status,200);assert.equal((await f.req('project',{title:'Sixth repair issue'})).status,403);});
test('resolved answers are saved without email; duplicate chat is idempotent',async()=>{const f=fixture();await login(f);const p=await f.req('project',{title:'Device filter issue'});const body={project_id:p.data.id,message:'How do I check the filter?',request_id:'00000000-0000-4000-8000-000000000000'};assert.equal((await f.req('chat',body)).status,200);await f.req('chat',body);assert.deepEqual(f.counts(),{emails:0,aiCalls:1});assert.equal((await f.req('projects')).data.projects[0].messages.length,2);assert.equal((await f.req('escalate',{project_id:p.data.id})).status,400);});
test('unresolved answers forward full conversation once',async()=>{const f=fixture({reply:{answer:'This needs personal inspection.',escalate:true,reason:'Cannot diagnose remotely'}});await login(f);const p=await f.req('project',{title:'Unknown equipment issue'});const r=await f.req('chat',{project_id:p.data.id,message:'What is causing this?',request_id:'00000000-0000-4000-8000-000000000000'});assert.equal(r.data.projects[0].status,'forwarded');await f.req('escalate',{project_id:p.data.id});assert.equal(f.counts().emails,1);});
test('forwarding failure remains pending instead of claiming success',async()=>{const f=fixture({emailFailure:true,reply:{answer:'I cannot resolve this.',escalate:true,reason:'Uncertain'}});await login(f);const p=await f.req('project',{title:'Unknown equipment issue'});const r=await f.req('chat',{project_id:p.data.id,message:'What is causing this?',request_id:'00000000-0000-4000-8000-000000000000'});assert.equal(r.data.projects[0].status,'pending_email');assert.equal((await f.req('escalate',{project_id:p.data.id})).status,503);});
test('cross-origin requests are rejected',async()=>{const f=fixture();const r=await f.handle(new Request('https://example.test/api/session',{method:'POST',headers:{origin:'https://attacker.test','content-type':'application/json'},body:JSON.stringify({session_id:'cs_live_fixture'})}));assert.equal(r.status,403);});
