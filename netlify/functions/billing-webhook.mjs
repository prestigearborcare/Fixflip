import { getStore } from '@netlify/blobs';
import { createBillingWebhook } from '../../lib/billing-webhook.mjs';
const rawKey=process.env.STRIPE_SECRET_KEY||'';
const candidates=rawKey.match(/(?:sk|rk)_live_[A-Za-z0-9]{32,}/g)||[];
export default async request=>createBillingWebhook({store:getStore({name:'fixflip-projects',consistency:'strong'}),env:{STRIPE_SECRET_KEY:candidates.length===1?candidates[0]:rawKey.trim(),STRIPE_WEBHOOK_SECRET:process.env.STRIPE_WEBHOOK_SECRET}})(request);
