const ALLOWED_ORIGINS = new Set(["https://1122-web-agent.pages.dev"]);
const PRIMARY_ORIGIN = "https://1122-web-agent.pages.dev";

function cors(origin = "") {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : PRIMARY_ORIGIN,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=UTF-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data, null, 2), { status, headers: cors(origin) });
}

async function checkD1(env) {
  if (!env.CORE_DB) return { configured: false, ready: false };
  try {
    const result = await env.CORE_DB.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").first();
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
        (SELECT COUNT(*) FROM product_operating_plans) AS operating_plans,
        (SELECT COUNT(*) FROM events) AS events,
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
      operatingPlans: Number(row?.operating_plans || 0),
      events: Number(row?.events || 0),
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
      "SELECT source_key, source_name, dataset, status, last_success_at, freshness_status FROM data_source_state ORDER BY source_key"
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
    return {
      configured: false,
      ready: false,
      status: "PENDING_ACCOUNT_ENABLEMENT",
      bucketName: "1122-data-archive",
    };
  }
  try {
    const object = await env.DATA_ARCHIVE.head("system/bootstrap/data-layer-v1.json");
    return {
      configured: true,
      ready: Boolean(object),
      status: object ? "READY" : "BOUND_AWAITING_BOOTSTRAP",
      bucketName: "1122-data-archive",
    };
  } catch {
    return {
      configured: true,
      ready: false,
      status: "BOUND_ERROR",
      bucketName: "1122-data-archive",
    };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ success: false, message: "Origin not allowed" }, 403, origin);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/status")) {
      const [d1, r2, summary, sources] = await Promise.all([
        checkD1(env),
        checkR2(env),
        getD1Summary(env),
        getSourceStates(env),
      ]);
      return json({
        success: true,
        service: "1122-data-layer",
        version: "1.1.0",
        storage: {
          d1: { role: "core-operating-facts", databaseName: "1122-core", ...d1 },
          r2: { role: "permanent-archive", ...r2 },
          kv: { role: "current-state-cache", existing: true, ready: true },
        },
        summary,
        sources,
        policy: {
          rawArchive: "retain",
          historicalFacts: "append-oriented",
          currentCache: "rebuildable",
          gitBusinessData: "forbidden",
        },
      }, 200, origin);
    }

    return json({ success: false, message: "Endpoint not found" }, 404, origin);
  },
};
