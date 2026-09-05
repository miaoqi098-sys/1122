import baseWorker from './worker.js';
import { buildUiBootstrap } from './ui-bootstrap.js';
import { loadOperatingIntelligence } from './ui-intelligence.js';
import { searchKnowledge, getKnowledgeStats } from './knowledge-store.js';

const ALLOWED_ORIGINS = new Set([
  'https://1122-web-agent.pages.dev',
  'https://miaoqi098-sys.github.io',
]);
const PRIMARY_ORIGIN = 'https://1122-web-agent.pages.dev';

function uiCors(origin = '') {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : PRIMARY_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Vary': 'Origin',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data, null, 2), { status, headers: uiCors(origin) });
}

function rejectIfInvalidOrigin(origin) {
  return origin && !ALLOWED_ORIGINS.has(origin);
}

export default {
  ...baseWorker,
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (url.pathname === '/api/v1/ui/bootstrap') {
      if (request.method === 'OPTIONS') {
        if (rejectIfInvalidOrigin(origin)) return new Response(null, { status: 403, headers: uiCors(origin) });
        return new Response(null, { status: 204, headers: uiCors(origin) });
      }
      if (request.method !== 'GET') return json({ success:false, message:'Method not allowed', read_only:true }, 405, origin);
      if (rejectIfInvalidOrigin(origin)) return json({ success:false, message:'Origin not allowed', read_only:true }, 403, origin);

      const marketplace = String(url.searchParams.get('marketplace') || 'US').toUpperCase();
      const payload = await buildUiBootstrap(env, { marketplace });
      const intelligence = await loadOperatingIntelligence(env.CORE_DB, marketplace);

      if (intelligence && !intelligence.error) {
        payload.apr = intelligence.apr;
        payload.aom = intelligence.aom;
        payload.apb = intelligence.apb;
        payload.source_status = {
          ...(payload.source_status || {}),
          apr:'LIVE_D1_READ',
          aom:'LIVE_D1_READ',
          apb:'LIVE_D1_READ',
        };
        payload.live_data_verified = false;
      } else if (intelligence?.error) {
        payload.source_status = {
          ...(payload.source_status || {}),
          intelligence_d1:'READ_ERROR',
          intelligence_error:intelligence.error,
        };
      }

      try {
        payload.knowledge = await getKnowledgeStats(env.CORE_DB);
        payload.source_status = { ...(payload.source_status || {}), knowledge:'LIVE_D1_READ' };
      } catch (error) {
        payload.knowledge = { source_status:'READ_ERROR', total:0, by_type:[], by_truth:[], error:String(error?.message || error) };
        payload.source_status = { ...(payload.source_status || {}), knowledge:'READ_ERROR' };
      }

      return json(payload, 200, origin);
    }

    if (url.pathname === '/api/v1/knowledge/search') {
      if (request.method === 'OPTIONS') {
        if (rejectIfInvalidOrigin(origin)) return new Response(null, { status: 403, headers: uiCors(origin) });
        return new Response(null, { status: 204, headers: uiCors(origin) });
      }
      if (request.method !== 'GET') return json({ success:false, message:'Method not allowed', read_only:true }, 405, origin);
      if (rejectIfInvalidOrigin(origin)) return json({ success:false, message:'Origin not allowed', read_only:true }, 403, origin);
      try {
        const result = await searchKnowledge(env.CORE_DB, {
          q:url.searchParams.get('q') || '',
          knowledge_type:url.searchParams.get('knowledge_type') || '',
          domain:url.searchParams.get('domain') || '',
          marketplace:url.searchParams.get('marketplace') || '',
          truth_class:url.searchParams.get('truth_class') || '',
          confidence:url.searchParams.get('confidence') || '',
          status:url.searchParams.get('status') || 'ACTIVE',
          limit:url.searchParams.get('limit') || '30',
        });
        return json(result, 200, origin);
      } catch (error) {
        return json({ items:[], total:0, source_status:'READ_ERROR', read_only:true, execution_authorized:false, production_write_authorized:false, error:String(error?.message || error) }, 500, origin);
      }
    }

    return baseWorker.fetch(request, env, ctx);
  },
};
