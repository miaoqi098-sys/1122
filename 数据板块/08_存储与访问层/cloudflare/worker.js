import { rebuildDerivedLayer, DERIVED_ENGINE_VERSION } from './derived.js';
import {
  intakeEventById,
  intakePendingEvents,
  A1_INTAKE_VERSION,
} from './a1-intake.js';
import {
  loadContextForEvent,
  loadPendingContexts,
  A1_CONTEXT_LOADER_VERSION,
} from './s02-context.js';
import { S02_RUNTIME_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S02_上下文装载/执行程序/runtime.js';

const ALLOWED_ORIGINS = new Set([
  'https://1122-web-agent.pages.dev',
  'https://miaoqi098-sys.github.io',
]);
const PRIMARY_ORIGIN = 'https://1122-web-agent.pages.dev';

function cors(origin = '') {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : PRIMARY_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data, null, 2), { status, headers: cors(origin) });
}

function isInternalAuthorized(request, env) {
  const expected = String(env.DATA_LAYER_INTERNAL_TOKEN || '').trim();
  if (!expected) return false;
  return String(request.headers.get('Authorization') || '') === `Bearer ${expected}`;
}

async function parseBody(request) {
  const contentType = String(request.headers.get('Content-Type') || '');
  if (!contentType.includes('application/json')) return {};
  try { return await request.json(); } catch { return {}; }
}

async function checkD1(env) {
  if (!env.CORE_DB) return { configured: false, ready: false };
  try {
    const result = await env.CORE_DB.prepare(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    ).first();
    return { configured: true, ready: Number(result?.count || 0) >= 10, tableCount: Number(result?.count || 0) };
  } catch {
    return { configured: true, ready: false, tableCount: 0 };
  }
}

async function getD1Summary(env) {
  if (!env.CORE_DB) return null;
  try {
    const row = await env.CORE_DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM inventory_snapshots) AS inventory_snapshots,
        (SELECT COUNT(*) FROM sales_period_snapshots) AS sales_period_snapshots,
        (SELECT COUNT(*) FROM traffic_daily) AS traffic_daily,
        (SELECT COUNT(*) FROM finance_period_snapshots) AS finance_period_snapshots,
        (SELECT COUNT(*) FROM product_daily_state) AS product_daily_state,
        (SELECT COUNT(*) FROM product_daily_metrics) AS product_daily_metrics,
        (SELECT COUNT(*) FROM events) AS events,
        (SELECT COUNT(*) FROM a1_event_intake_runs) AS a1_event_intakes,
        (SELECT COUNT(*) FROM a1_event_intake_runs WHERE intake_status='READY_FOR_S02') AS a1_ready_for_s02,
        (SELECT COUNT(*) FROM a1_context_runs) AS a1_context_runs,
        (SELECT COUNT(*) FROM a1_context_runs WHERE s02_status IN ('ready','ready_with_gaps')) AS a1_context_ready,
        (SELECT COUNT(*) FROM decisions) AS decisions,
        (SELECT COUNT(*) FROM tasks) AS tasks,
        (SELECT COUNT(*) FROM validation_results) AS validations,
        (SELECT COUNT(*) FROM raw_archive_manifest) AS archive_manifest,
        (SELECT COUNT(*) FROM data_layer_audit) AS audits
    `).first();
    return {
      products: Number(row?.products || 0),
      inventorySnapshots: Number(row?.inventory_snapshots || 0),
      salesPeriodSnapshots: Number(row?.sales_period_snapshots || 0),
      trafficDailyRecords: Number(row?.traffic_daily || 0),
      financePeriodSnapshots: Number(row?.finance_period_snapshots || 0),
      productDailyStates: Number(row?.product_daily_state || 0),
      productDailyMetrics: Number(row?.product_daily_metrics || 0),
      events: Number(row?.events || 0),
      a1EventIntakes: Number(row?.a1_event_intakes || 0),
      a1ReadyForS02: Number(row?.a1_ready_for_s02 || 0),
      a1ContextRuns: Number(row?.a1_context_runs || 0),
      a1ContextReady: Number(row?.a1_context_ready || 0),
      decisions: Number(row?.decisions || 0),
      tasks: Number(row?.tasks || 0),
      validations: Number(row?.validations || 0),
      archiveManifestRecords: Number(row?.archive_manifest || 0),
      audits: Number(row?.audits || 0),
    };
  } catch {
    return null;
  }
}

async function getSourceStates(env) {
  if (!env.CORE_DB) return [];
  try {
    const result = await env.CORE_DB.prepare(
      'SELECT source_key, source_name, dataset, status, last_success_at, freshness_status FROM data_source_state ORDER BY source_key',
    ).all();
    return (result?.results || []).map((row) => ({
      sourceKey: row.source_key,
      sourceName: row.source_name,
      dataset: row.dataset,
      status: row.status,
      lastSuccessAt: row.last_success_at,
      freshnessStatus: row.freshness_status,
    }));
  } catch {
    return [];
  }
}

async function checkR2(env) {
  if (!env.DATA_ARCHIVE) {
    return { configured: false, ready: false, status: 'PENDING_ACCOUNT_ENABLEMENT', bucketName: '1122-data-archive' };
  }
  try {
    const object = await env.DATA_ARCHIVE.head('system/bootstrap/data-layer-v1.json');
    return {
      configured: true,
      ready: Boolean(object),
      status: object ? 'READY' : 'BOUND_AWAITING_BOOTSTRAP',
      bucketName: '1122-data-archive',
    };
  } catch {
    return { configured: true, ready: false, status: 'BOUND_ERROR', bucketName: '1122-data-archive' };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ success: false, message: 'Origin not allowed' }, 403, origin);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/status')) {
      const [d1, r2, summary, sources] = await Promise.all([
        checkD1(env), checkR2(env), getD1Summary(env), getSourceStates(env),
      ]);
      return json({
        success: true,
        service: '1122-data-layer',
        version: '1.5.0',
        storage: {
          d1: { role: 'core-operating-facts', databaseName: '1122-core', ...d1 },
          r2: { role: 'permanent-archive', ...r2 },
          kv: { role: 'current-state-cache', existing: true, ready: true },
        },
        derivedLayer: {
          version: DERIVED_ENGINE_VERSION,
          pipeline: ['ProductDailyState', 'Metric', 'Event'],
          eventPolicy: 'deterministic-rules-only',
          execution: 'batch-d1',
        },
        a1Intake: {
          version: A1_INTAKE_VERSION,
          pipeline: ['RawEvent', 'CanonicalEvent', 'S01', 'NormalizedEvent', 'A1IntakeLedger'],
          bypassS01: false,
          readyForS02OnlyAfter: ['passed', 'passed_with_warnings'],
        },
        a1Context: {
          version: A1_CONTEXT_LOADER_VERSION,
          runtimeVersion: S02_RUNTIME_VERSION,
          pipeline: ['S01NormalizedEvent', 'ContextPlanner', 'D1Retriever', 'FreshnessCheck', 'ContextPackage', 'A1ContextLedger'],
          contextPackageIsUniqueFactSource: true,
          automaticAfterS01: true,
          outputs: ['ready', 'ready_with_gaps', 'needs_information', 'blocked'],
        },
        summary,
        sources,
        policy: {
          rawArchive: 'retain',
          historicalFacts: 'append-oriented',
          currentCache: 'rebuildable',
          gitBusinessData: 'forbidden',
        },
      }, 200, origin);
    }

    if (request.method === 'GET' && url.pathname === '/internal/auth-check') {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: 'Unauthorized' }, 401, origin);
      return json({ success: true, service: '1122-data-layer', auth: 'ready' }, 200, origin);
    }

    if (request.method === 'POST' && url.pathname === '/internal/rebuild-derived') {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: 'Unauthorized' }, 401, origin);
      if (!env.CORE_DB) return json({ success: false, message: 'CORE_DB is not configured' }, 503, origin);
      try {
        const marketplace = String(url.searchParams.get('marketplace') || 'US').toUpperCase();
        const productLimit = Math.min(Math.max(Number(url.searchParams.get('productLimit') || 5), 1), 20);
        const dateLimit = Math.min(Math.max(Number(url.searchParams.get('dateLimit') || 60), 7), 180);
        const result = await rebuildDerivedLayer(env, marketplace, productLimit, dateLimit);
        const a1Intake = await intakePendingEvents(env, { source: 'derived_layer_v1', limit: 20 });
        const a1Context = await loadPendingContexts(env, { limit: 10 });
        return json({ success: true, ...result, a1Intake, a1Context }, 200, origin);
      } catch (error) {
        return json({ success: false, message: 'Derived Layer rebuild failed', error: error.message }, 500, origin);
      }
    }

    if (request.method === 'POST' && url.pathname === '/internal/a1/intake-event') {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: 'Unauthorized' }, 401, origin);
      if (!env.CORE_DB) return json({ success: false, message: 'CORE_DB is not configured' }, 503, origin);
      const body = await parseBody(request);
      const eventId = String(body?.event_id || url.searchParams.get('event_id') || '').trim();
      if (!eventId) return json({ success: false, message: 'event_id is required' }, 400, origin);
      try {
        const result = await intakeEventById(env, eventId);
        if (!result.found) return json({ success: false, message: 'Event not found', eventId }, 404, origin);
        const s02Context = result.intakeStatus === 'READY_FOR_S02'
          ? await loadContextForEvent(env, eventId, { contextRequest: body?.context_request || undefined })
          : null;
        return json({ success: true, ...result, s02Context }, 200, origin);
      } catch (error) {
        return json({ success: false, message: 'A1 event intake failed', error: error.message }, 500, origin);
      }
    }

    if (request.method === 'POST' && url.pathname === '/internal/a1/intake-pending') {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: 'Unauthorized' }, 401, origin);
      if (!env.CORE_DB) return json({ success: false, message: 'CORE_DB is not configured' }, 503, origin);
      try {
        const source = String(url.searchParams.get('source') || 'derived_layer_v1');
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 50);
        const result = await intakePendingEvents(env, { source, limit });
        const s02Context = await loadPendingContexts(env, { limit: Math.min(limit, 10) });
        return json({ success: true, ...result, s02Context }, 200, origin);
      } catch (error) {
        return json({ success: false, message: 'A1 pending intake failed', error: error.message }, 500, origin);
      }
    }

    if (request.method === 'POST' && url.pathname === '/internal/a1/context-event') {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: 'Unauthorized' }, 401, origin);
      if (!env.CORE_DB) return json({ success: false, message: 'CORE_DB is not configured' }, 503, origin);
      const body = await parseBody(request);
      const eventId = String(body?.event_id || url.searchParams.get('event_id') || '').trim();
      if (!eventId) return json({ success: false, message: 'event_id is required' }, 400, origin);
      try {
        const result = await loadContextForEvent(env, eventId, { contextRequest: body?.context_request || undefined });
        if (!result.found) return json({ success: false, message: 'No READY_FOR_S02 intake found for event', eventId }, 404, origin);
        return json({ success: true, ...result }, 200, origin);
      } catch (error) {
        return json({ success: false, message: 'S02 context loading failed', error: error.message }, 500, origin);
      }
    }

    if (request.method === 'POST' && url.pathname === '/internal/a1/context-pending') {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: 'Unauthorized' }, 401, origin);
      if (!env.CORE_DB) return json({ success: false, message: 'CORE_DB is not configured' }, 503, origin);
      try {
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 10), 1), 10);
        const result = await loadPendingContexts(env, { limit });
        return json({ success: true, ...result }, 200, origin);
      } catch (error) {
        return json({ success: false, message: 'S02 pending context loading failed', error: error.message }, 500, origin);
      }
    }

    return json({ success: false, message: 'Endpoint not found' }, 404, origin);
  },
};

// deploy marker: s02-context-v1.0-auth-readiness
