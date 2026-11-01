import { getStore } from '@netlify/blobs';
import { createService } from '../../lib/service.mjs';
// Test credentials, signed cookie and saved projects stay separate from production.
export default async request => createService({
  store:getStore({name:'fixflip-sandbox-projects',consistency:'strong'}),
  env:{...process.env,STRIPE_SECRET_KEY:process.env.STRIPE_TEST_SECRET_KEY?.trim(),
    SESSION_SECRET:undefined,FIXFLIP_LIVE:'true',ESCALATION_EMAIL_READY:'true'},
  sandbox:true,singlePrice:'price_1UX5ZNRsNlbU5mNLI7pe0Xzq',monthlyPrice:'unused_sandbox_monthly'
})(request);
