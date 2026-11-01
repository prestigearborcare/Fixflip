import { getStore } from '@netlify/blobs';
import { createService } from '../../lib/service.mjs';
const rawKey=process.env.STRIPE_SECRET_KEY||'';
const candidates=rawKey.match(/(?:sk|rk)_live_[A-Za-z0-9]{32,}/g)||[];
const liveKey=candidates.length===1?candidates[0]:rawKey.trim();
export default async request => createService({store:getStore({name:'fixflip-projects',consistency:'strong'}),env:{...process.env,STRIPE_SECRET_KEY:liveKey}})(request);
