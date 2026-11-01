import { getStore } from '@netlify/blobs';
import { createService } from '../../lib/service.mjs';
const rawKey=process.env.STRIPE_TEST_SECRET_KEY||'';
// Accept a copied assignment or quoted value, but never guess between keys.
const candidates=rawKey.match(/(?:sk|rk)_test_[A-Za-z0-9]{32,}/g)||[];
const testKey=candidates.length===1?candidates[0]:rawKey.trim();
// Test credentials, signed cookie and saved projects stay separate from production.
export default async request => createService({
  store:getStore({name:'fixflip-sandbox-projects',consistency:'strong'}),
  env:{...process.env,STRIPE_SECRET_KEY:testKey,
    SESSION_SECRET:undefined,FIXFLIP_LIVE:'true',ESCALATION_EMAIL_READY:'true'},
  sandbox:true,singlePrice:'price_1UX5ZNRsNlbU5mNLI7pe0Xzq',monthlyPrice:'unused_sandbox_monthly'
})(request);
