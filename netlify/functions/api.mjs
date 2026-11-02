import { getStore } from '@netlify/blobs';
import { createService } from '../../lib/service.mjs';
const rawKey=process.env.STRIPE_SECRET_KEY||'';
const candidates=rawKey.match(/(?:sk|rk)_live_[A-Za-z0-9]{32,}/g)||[];
const liveKey=candidates.length===1?candidates[0]:rawKey.trim();
export default async request => createService({store:getStore({name:'fixflip-projects',consistency:'strong'}),env:{...process.env,STRIPE_SECRET_KEY:liveKey,
  // AI Gateway values are supplied lazily by Netlify; read them explicitly.
  OPENAI_API_KEY:process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL:process.env.OPENAI_BASE_URL,
  OPENAI_MODEL:process.env.OPENAI_MODEL,
  FIXFLIP_LIVE:process.env.FIXFLIP_LIVE,
  ESCALATION_EMAIL_READY:process.env.ESCALATION_EMAIL_READY
}})(request);
