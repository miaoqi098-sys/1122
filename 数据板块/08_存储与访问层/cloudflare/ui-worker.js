import baseWorker from './worker.js';
import { buildUiBootstrap } from './ui-bootstrap.js';

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

export default {
  ...baseWorker,
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (url.pathname === '/api/v1/ui/bootstrap') {
      if (request.method === 'OPTIONS') {
        if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403, headers: uiCors(origin) });
        return new Response(null, { status: 204, headers: uiCors(origin) });
      }
      if (request.method !== 'GET') return json({ success:false, message:'Method not allowed', read_only:true }, 405, origin);
      if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ success:false, message:'Origin not allowed', read_only:true }, 403, origin);

      const marketplace = String(url.searchParams.get('marketplace') || 'US').toUpperCase();
      const payload = await buildUiBootstrap(env, { marketplace });
      return json(payload, 200, origin);
    }

    return baseWorker.fetch(request, env, ctx);
  },
};
