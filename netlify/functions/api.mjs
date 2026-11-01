import { getStore } from '@netlify/blobs';
import { createService } from '../../lib/service.mjs';
export default async request => createService({store:getStore({name:'fixflip-projects',consistency:'strong'}),env:process.env})(request);
