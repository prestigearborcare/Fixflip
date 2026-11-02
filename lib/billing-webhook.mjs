import { createHmac, timingSafeEqual } from 'node:crypto';
const idOf = value => typeof value==='string'?value:value?.id;
const types=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','charge.refunded','charge.dispute.created','radar.early_fraud_warning.created']);
export function createBillingWebhook({store,env,fetcher=fetch,now=()=>Date.now()}){
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 const stripe=async path=>{const r=await fetcher('https://api.stripe.com/v1/'+path,{headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Stripe lookup failed');return r.json();};
 return async request=>{
  if(request.method!=='POST')return reply({error:'Method not allowed'},405);
  if(!env.STRIPE_WEBHOOK_SECRET)return reply({error:'Billing notifications are not configured'},503);
  try{
   const text=await request.text();if(text.length>1000000)return reply({error:'Payload too large'},413);
   const fields=(request.headers.get('stripe-signature')||'').split(',').map(p=>p.split('='));
   const stamp=fields.find(([k])=>k==='t')?.[1];
   if(!/^\d+$/.test(stamp||'')||Math.abs(now()/1000-Number(stamp))>300)return reply({error:'Invalid signature'},400);
   const expected=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(stamp+'.'+text).digest();
   const valid=fields.filter(([k])=>k==='v1').some(([,v])=>{if(!/^[a-f0-9]{64}$/.test(v||''))return false;return timingSafeEqual(expected,Buffer.from(v,'hex'));});
   if(!valid)return reply({error:'Invalid signature'},400);
   const event=JSON.parse(text);
   if(event.livemode!==true||!/^evt_[A-Za-z0-9]+$/.test(event.id||''))return reply({error:'Wrong billing environment'},400);
   if(!types.has(event.type))return reply({received:true,ignored:true});
   if(await store.get('billing-event-'+event.id,{type:'json'}))return reply({received:true});
   const object=event.data.object;
   if(['charge.refunded','charge.dispute.created','radar.early_fraud_warning.created'].includes(event.type)){
    const chargeId=object.object==='charge'?object.id:idOf(object.charge);
    const charge=chargeId?await stripe('charges/'+encodeURIComponent(chargeId)):null;
    const intent=idOf(charge?.payment_intent)||idOf(object.payment_intent);
    let invoices=charge?.invoice?[idOf(charge.invoice)]:[];
    if(!invoices.length&&intent){
     const payments=await stripe('invoice_payments?payment[type]=payment_intent&payment[payment_intent]='+encodeURIComponent(intent)+'&limit=100');
     if(payments.has_more)throw Error('Billing relationship needs review');
     invoices=(payments.data||[]).map(p=>idOf(p.invoice)).filter(Boolean);
    }
    // One-time payments are also checked directly for refunds/disputes on access.
    for(const invoice of new Set(invoices))await store.setJSON('blocked-invoice-'+invoice,{event:event.id,reason:event.type,received:now()});
   } else if(event.type.startsWith('customer.subscription.')){
    // Re-fetch authoritative state so delayed notifications cannot restore access.
    const subscription=await stripe('subscriptions/'+encodeURIComponent(object.id));
    await store.setJSON('billing-subscription-'+object.id,{status:subscription.status,event:event.id,checked:now()});
   } else if(event.type.startsWith('invoice.')){
    const invoice=await stripe('invoices/'+encodeURIComponent(object.id));
    await store.setJSON('billing-invoice-'+object.id,{status:invoice.status,event:event.id,checked:now()});
   } else if(object.payment_status==='paid'){
    await store.setJSON('billing-checkout-'+object.id,{paid:true,event:event.id,checked:now()});
   }
   // Acknowledge only after durable writes. Stripe retries failures; replays never add credits.
   await store.setJSON('billing-event-'+event.id,{type:event.type,received:now()});
   return reply({received:true});
  }catch{return reply({error:'Billing reconciliation failed; retry required'},503);}
 };
}
