import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createBillingWebhook} from '../lib/billing-webhook.mjs';
function fixture(){
 const data=new Map();let writes=0;
 const store={async get(k){return data.get(k)||null;},async setJSON(k,v){writes++;data.set(k,v);}};
 const handle=createBillingWebhook({store,env:{STRIPE_WEBHOOK_SECRET:'test-only-signing-secret',STRIPE_SECRET_KEY:'fixture'},now:()=>1000000,fetcher:async url=>{
  if(url.includes('/charges/'))return Response.json({payment_intent:'pi_fixture'});
  if(url.includes('/invoice_payments?'))return Response.json({data:[{invoice:'in_fixture'}],has_more:false});
  if(url.includes('/subscriptions/'))return Response.json({status:'canceled'});
  if(url.includes('/invoices/'))return Response.json({status:'paid'});
  throw Error('Unexpected lookup');
 }});
 async function send(event,{bad=false,stamp='1000'}={}){
  const body=JSON.stringify({id:'evt_fixture',livemode:true,...event});
  const sig=createHmac('sha256','test-only-signing-secret').update(stamp+'.'+body).digest('hex');
  return handle(new Request('https://example.test/.netlify/functions/billing-webhook',{method:'POST',headers:{'stripe-signature':`t=${stamp},v1=${bad?'0'.repeat(64):sig}`},body}));
 }
 return {send,data,writes:()=>writes};
}
test('webhooks reject invalid, expired and test-mode events without writing',async()=>{
 const f=fixture();const e={type:'invoice.paid',data:{object:{id:'in_fixture'}}};
 assert.equal((await f.send(e,{bad:true})).status,400);assert.equal((await f.send(e,{stamp:'1'})).status,400);assert.equal((await f.send({...e,livemode:false})).status,400);assert.equal(f.writes(),0);
});
test('refund webhook blocks invoice credits and duplicate delivery is idempotent',async()=>{
 const f=fixture();const event={type:'charge.refunded',data:{object:{object:'charge',id:'ch_fixture'}}};
 assert.equal((await f.send(event)).status,200);assert.ok(f.data.has('blocked-invoice-in_fixture'));const writes=f.writes();await f.send(event);assert.equal(f.writes(),writes);
});
test('subscription notifications reconcile current status instead of stale event data',async()=>{
 const f=fixture();await f.send({type:'customer.subscription.updated',data:{object:{id:'sub_fixture',status:'active'}}});assert.equal(f.data.get('billing-subscription-sub_fixture').status,'canceled');
});
