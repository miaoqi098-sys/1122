const ALLOWED_ORIGINS = new Set([
  "https://1122-web-agent.pages.dev",
  "https://miaoqi098-sys.github.io",
]);
const PRIMARY_ORIGIN = "https://1122-web-agent.pages.dev";
const ENGINE_VERSION = "derived-v1";

function cors(origin = "") {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : PRIMARY_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=UTF-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data, null, 2), { status, headers: cors(origin) });
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asInteger(value) {
  const n = asNumber(value);
  return n === null ? null : Math.round(n);
}

function firstNumber(...values) {
  for (const value of values) {
    const n = asNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function average(values) {
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function pctDelta(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) return null;
  return (current - baseline) / Math.abs(baseline);
}

function nowIso() {
  return new Date().toISOString();
}

function isInternalAuthorized(request, env) {
  const expected = String(env.DATA_LAYER_INTERNAL_TOKEN || "").trim();
  if (!expected) return false;
  return String(request.headers.get("Authorization") || "") === `Bearer ${expected}`;
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
        (SELECT COUNT(*) FROM product_daily_state) AS product_daily_state,
        (SELECT COUNT(*) FROM product_daily_metrics) AS product_daily_metrics,
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
      productDailyStates: Number(row?.product_daily_state || 0),
      productDailyMetrics: Number(row?.product_daily_metrics || 0),
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

async function selectProductsForDerivedBuild(db, marketplace, limit) {
  const result = await db.prepare(`
    SELECT p.product_id, p.marketplace, p.asin, p.listing_price, p.regular_price, p.currency
    FROM products p
    WHERE p.marketplace = ?
      AND p.asin IS NOT NULL
      AND p.asin <> ''
      AND (
        EXISTS (SELECT 1 FROM traffic_daily t WHERE t.product_id = p.product_id)
        OR EXISTS (SELECT 1 FROM sif_asin_traffic_daily s WHERE s.product_id = p.product_id)
      )
    ORDER BY COALESCE(
      (SELECT MAX(s.business_date) FROM sif_asin_traffic_daily s WHERE s.product_id = p.product_id),
      (SELECT MAX(t.business_date) FROM traffic_daily t WHERE t.product_id = p.product_id),
      '1970-01-01'
    ) DESC, p.updated_at DESC
    LIMIT ?
  `).bind(marketplace, limit).all();
  return result?.results || [];
}

async function selectProductDates(db, productId, dateLimit) {
  const result = await db.prepare(`
    SELECT business_date
    FROM (
      SELECT business_date FROM traffic_daily WHERE product_id = ?
      UNION
      SELECT business_date FROM sif_asin_traffic_daily WHERE product_id = ?
    )
    ORDER BY business_date DESC
    LIMIT ?
  `).bind(productId, productId, dateLimit).all();
  return (result?.results || []).map((r) => String(r.business_date)).sort();
}

async function loadDailyInputs(db, product, businessDate) {
  const [amazon, sif, inventory, plan, velocity] = await Promise.all([
    db.prepare(`SELECT * FROM traffic_daily WHERE product_id = ? AND business_date = ? ORDER BY observed_at DESC LIMIT 1`)
      .bind(product.product_id, businessDate).first(),
    db.prepare(`SELECT * FROM sif_asin_traffic_daily WHERE product_id = ? AND business_date = ? ORDER BY observed_at DESC LIMIT 1`)
      .bind(product.product_id, businessDate).first(),
    db.prepare(`SELECT * FROM inventory_snapshots WHERE product_id = ? AND substr(observed_at,1,10) <= ? ORDER BY observed_at DESC LIMIT 1`)
      .bind(product.product_id, businessDate).first(),
    db.prepare(`SELECT stage, primary_goal, version FROM product_operating_plans WHERE product_id = ? AND status = 'ACTIVE' ORDER BY updated_at DESC LIMIT 1`)
      .bind(product.product_id).first(),
    db.prepare(`SELECT AVG(units_ordered) AS avg_units FROM traffic_daily WHERE product_id = ? AND business_date >= date(?, '-7 days') AND business_date < ? AND units_ordered IS NOT NULL`)
      .bind(product.product_id, businessDate, businessDate).first(),
  ]);
  return { amazon, sif, inventory, plan, velocity };
}

function buildDailyState(product, businessDate, inputs) {
  const { amazon, sif, inventory, plan, velocity } = inputs;
  const units = asInteger(amazon?.units_ordered);
  const sessions = asInteger(amazon?.sessions);
  const conversionRate = sessions && sessions > 0 && units !== null ? units / sessions : null;
  const fulfillable = asInteger(inventory?.fulfillable_quantity);
  const avgUnits = asNumber(velocity?.avg_units);
  const coverageDays = fulfillable !== null && avgUnits && avgUnits > 0 ? fulfillable / avgUnits : null;
  const inbound = firstNumber(
    inventory?.inbound_total_quantity,
    (asNumber(inventory?.inbound_working_quantity) || 0) +
      (asNumber(inventory?.inbound_shipped_quantity) || 0) +
      (asNumber(inventory?.inbound_receiving_quantity) || 0)
  );

  const sourcePresence = {
    amazonTraffic: Boolean(amazon),
    sifTraffic: Boolean(sif),
    inventory: Boolean(inventory),
    operatingPlan: Boolean(plan),
  };
  const sourceCount = Object.values(sourcePresence).filter(Boolean).length;
  const dataQualityStatus = sourceCount >= 3 ? "FULL" : sourceCount >= 2 ? "PARTIAL" : "LIMITED";

  return {
    product_id: product.product_id,
    marketplace: product.marketplace,
    business_date: businessDate,
    stage: plan?.stage ?? null,
    price: firstNumber(sif?.buybox_price, sif?.deal_price, product.listing_price, product.regular_price),
    sales: asNumber(amazon?.ordered_product_sales),
    units,
    orders_count: asInteger(amazon?.order_items),
    sessions,
    page_views: asInteger(amazon?.page_views),
    conversion_rate: conversionRate,
    ad_spend: null,
    ad_sales: null,
    acos: null,
    tacos: null,
    fulfillable_inventory: fulfillable,
    inbound_inventory: inbound === null ? null : Math.round(inbound),
    coverage_days: coverageDays,
    rating: asNumber(sif?.star_rating),
    review_count: asInteger(sif?.review_count),
    contribution_profit: null,
    profit_margin: null,
    primary_goal: plan?.primary_goal ?? null,
    strategy_version: asInteger(plan?.version),
    market_total_score: asNumber(sif?.total_score),
    market_natural_score: asNumber(sif?.natural_score),
    market_ad_score: asNumber(sif?.ad_score),
    bsr: asInteger(sif?.bsr),
    data_quality_status: dataQualityStatus,
    completeness_json: JSON.stringify({ sources: sourcePresence, missing: Object.entries(sourcePresence).filter(([, v]) => !v).map(([k]) => k) }),
  };
}

async function upsertDailyState(db, state, observedAt) {
  await db.prepare(`
    INSERT INTO product_daily_state (
      product_daily_state_id, product_id, marketplace, business_date, stage, price, sales, units,
      orders_count, sessions, page_views, conversion_rate, ad_spend, ad_sales, acos, tacos,
      fulfillable_inventory, inbound_inventory, coverage_days, rating, review_count,
      contribution_profit, profit_margin, primary_goal, strategy_version, completeness_json,
      observed_at, market_total_score, market_natural_score, market_ad_score, bsr, data_quality_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(product_id, business_date) DO UPDATE SET
      marketplace=excluded.marketplace,
      stage=excluded.stage,
      price=excluded.price,
      sales=excluded.sales,
      units=excluded.units,
      orders_count=excluded.orders_count,
      sessions=excluded.sessions,
      page_views=excluded.page_views,
      conversion_rate=excluded.conversion_rate,
      fulfillable_inventory=excluded.fulfillable_inventory,
      inbound_inventory=excluded.inbound_inventory,
      coverage_days=excluded.coverage_days,
      rating=excluded.rating,
      review_count=excluded.review_count,
      primary_goal=excluded.primary_goal,
      strategy_version=excluded.strategy_version,
      completeness_json=excluded.completeness_json,
      observed_at=excluded.observed_at,
      market_total_score=excluded.market_total_score,
      market_natural_score=excluded.market_natural_score,
      market_ad_score=excluded.market_ad_score,
      bsr=excluded.bsr,
      data_quality_status=excluded.data_quality_status
  `).bind(
    crypto.randomUUID(), state.product_id, state.marketplace, state.business_date, state.stage,
    state.price, state.sales, state.units, state.orders_count, state.sessions, state.page_views,
    state.conversion_rate, state.ad_spend, state.ad_sales, state.acos, state.tacos,
    state.fulfillable_inventory, state.inbound_inventory, state.coverage_days, state.rating,
    state.review_count, state.contribution_profit, state.profit_margin, state.primary_goal,
    state.strategy_version, state.completeness_json, observedAt, state.market_total_score,
    state.market_natural_score, state.market_ad_score, state.bsr, state.data_quality_status
  ).run();
}

const METRIC_DEFINITIONS = [
  ["product.price", "price", "combined"],
  ["amazon.sales", "sales", "amazon"],
  ["amazon.units", "units", "amazon"],
  ["amazon.sessions", "sessions", "amazon"],
  ["amazon.page_views", "page_views", "amazon"],
  ["amazon.conversion_rate", "conversion_rate", "amazon"],
  ["inventory.fulfillable", "fulfillable_inventory", "amazon"],
  ["inventory.coverage_days", "coverage_days", "derived"],
  ["sif.total_traffic_score", "market_total_score", "sif"],
  ["sif.natural_traffic_score", "market_natural_score", "sif"],
  ["sif.ad_traffic_score", "market_ad_score", "sif"],
  ["sif.bsr", "bsr", "sif"],
  ["reputation.rating", "rating", "sif"],
  ["reputation.review_count", "review_count", "sif"],
];

function metricSignal(metricKey, value, baseline, prior, historyCount) {
  if (!Number.isFinite(value)) return "NO_VALUE";
  if (metricKey === "inventory.coverage_days") {
    if (value <= 3) return "CRITICAL_LOW";
    if (value <= 7) return "LOW";
    return "NORMAL";
  }
  if (metricKey === "product.price" && Number.isFinite(prior) && prior !== 0) {
    const d = Math.abs((value - prior) / Math.abs(prior));
    if (d >= 0.1) return "LARGE_CHANGE";
    if (d >= 0.05) return "CHANGE";
  }
  if (historyCount < 3 || !Number.isFinite(baseline)) return "INSUFFICIENT_BASELINE";
  const d = pctDelta(value, baseline);
  if (d === null) return "NORMAL";
  if (metricKey === "sif.bsr") {
    if (d >= 0.4) return "DETERIORATION_HIGH";
    if (d >= 0.25) return "DETERIORATION";
    if (d <= -0.25) return "IMPROVEMENT";
    return "NORMAL";
  }
  const dropThreshold = metricKey === "sif.ad_traffic_score" ? -0.25 : -0.20;
  if (["sif.total_traffic_score", "sif.natural_traffic_score", "sif.ad_traffic_score", "amazon.sessions", "amazon.conversion_rate"].includes(metricKey)) {
    if (d <= dropThreshold - 0.15) return "DROP_HIGH";
    if (d <= dropThreshold) return "DROP";
    if (d >= 0.2) return "RISE";
  }
  return "NORMAL";
}

async function rebuildMetricsForProduct(db, productId, marketplace, computedAt) {
  const result = await db.prepare(`
    SELECT * FROM product_daily_state
    WHERE product_id = ?
    ORDER BY business_date ASC
  `).bind(productId).all();
  const states = result?.results || [];
  const histories = new Map();
  const latestMetrics = new Map();
  let metricRows = 0;

  for (const state of states) {
    for (const [metricKey, field, source] of METRIC_DEFINITIONS) {
      const value = asNumber(state[field]);
      const history = histories.get(metricKey) || [];
      const prior = history.length ? history[history.length - 1] : null;
      const baselineValues = history.slice(-7);
      const baseline = average(baselineValues);
      const deltaAbs = Number.isFinite(value) && Number.isFinite(baseline) ? value - baseline : null;
      const deltaPct = pctDelta(value, baseline);
      const direction = deltaPct === null ? null : deltaPct > 0.01 ? "UP" : deltaPct < -0.01 ? "DOWN" : "FLAT";
      const signal = metricSignal(metricKey, value, baseline, prior, baselineValues.length);

      await db.prepare(`
        INSERT INTO product_daily_metrics (
          metric_id, product_id, marketplace, business_date, metric_key, metric_value,
          prior_value, baseline_7d, delta_abs, delta_pct, direction, signal, source,
          computed_at, engine_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(product_id, business_date, metric_key) DO UPDATE SET
          metric_value=excluded.metric_value,
          prior_value=excluded.prior_value,
          baseline_7d=excluded.baseline_7d,
          delta_abs=excluded.delta_abs,
          delta_pct=excluded.delta_pct,
          direction=excluded.direction,
          signal=excluded.signal,
          source=excluded.source,
          computed_at=excluded.computed_at,
          engine_version=excluded.engine_version
      `).bind(
        crypto.randomUUID(), productId, marketplace, state.business_date, metricKey,
        value, prior, baseline, deltaAbs, deltaPct, direction, signal, source, computedAt, ENGINE_VERSION
      ).run();
      metricRows += 1;

      latestMetrics.set(metricKey, {
        productId,
        marketplace,
        businessDate: state.business_date,
        metricKey,
        value,
        prior,
        baseline,
        deltaPct,
        signal,
        historyCount: baselineValues.length,
      });
      if (Number.isFinite(value)) {
        history.push(value);
        histories.set(metricKey, history);
      }
    }
  }
  return { metricRows, latestMetrics };
}

function eventRule(metric) {
  const { metricKey, value, prior, baseline, deltaPct, historyCount } = metric;
  if (metricKey === "inventory.coverage_days" && Number.isFinite(value) && value <= 7) {
    return {
      eventType: "INVENTORY_COVERAGE_LOW",
      severity: value <= 3 ? "HIGH" : "MEDIUM",
      threshold: { coverageDaysLte: 7, criticalLte: 3 },
    };
  }
  if (metricKey === "product.price" && Number.isFinite(value) && Number.isFinite(prior) && prior !== 0) {
    const changePct = (value - prior) / Math.abs(prior);
    if (Math.abs(changePct) >= 0.05) {
      return {
        eventType: "PRICE_CHANGE",
        severity: Math.abs(changePct) >= 0.1 ? "HIGH" : "MEDIUM",
        threshold: { absoluteChangePctGte: 0.05 },
        overrideDeltaPct: changePct,
      };
    }
  }
  if (historyCount < 3 || !Number.isFinite(baseline) || deltaPct === null) return null;

  const rules = {
    "sif.total_traffic_score": ["MARKET_TRAFFIC_DROP", -0.20],
    "sif.natural_traffic_score": ["NATURAL_TRAFFIC_DROP", -0.20],
    "sif.ad_traffic_score": ["AD_TRAFFIC_DROP", -0.25],
    "amazon.sessions": ["AMAZON_SESSIONS_DROP", -0.20],
    "amazon.conversion_rate": ["CONVERSION_DROP", -0.20],
  };
  if (rules[metricKey]) {
    const [eventType, threshold] = rules[metricKey];
    if (deltaPct <= threshold) {
      return {
        eventType,
        severity: deltaPct <= threshold - 0.15 ? "HIGH" : "MEDIUM",
        threshold: { deltaPctLte: threshold },
      };
    }
  }
  if (metricKey === "sif.bsr" && deltaPct >= 0.25) {
    return {
      eventType: "BSR_DETERIORATION",
      severity: deltaPct >= 0.40 ? "HIGH" : "MEDIUM",
      threshold: { deltaPctGte: 0.25 },
    };
  }
  return null;
}

async function emitLatestEvents(db, latestMetrics, computedAt) {
  let eventRows = 0;
  const emitted = [];
  for (const metric of latestMetrics.values()) {
    const rule = eventRule(metric);
    if (!rule) continue;
    const effectiveDeltaPct = rule.overrideDeltaPct ?? metric.deltaPct;
    const dedupKey = `${metric.productId}:${metric.businessDate}:${rule.eventType}:${metric.metricKey}:${ENGINE_VERSION}`;
    const evidence = {
      metricKey: metric.metricKey,
      currentValue: metric.value,
      priorValue: metric.prior,
      baseline7d: metric.baseline,
      deltaPct: effectiveDeltaPct,
      historyPoints: metric.historyCount,
      threshold: rule.threshold,
    };
    const result = await db.prepare(`
      INSERT OR IGNORE INTO events (
        event_id, product_id, marketplace, event_type, severity, source, event_status,
        processing_disposition, evidence_json, payload_json, occurred_at, dedup_key
      ) VALUES (?, ?, ?, ?, ?, 'derived_layer_v1', 'NEW', 'AWAITING_A1', ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), metric.productId, metric.marketplace, rule.eventType, rule.severity,
      JSON.stringify(evidence),
      JSON.stringify({ engineVersion: ENGINE_VERSION, deterministic: true }),
      `${metric.businessDate}T23:59:59Z`, dedupKey
    ).run();
    const changes = Number(result?.meta?.changes || 0);
    eventRows += changes;
    if (changes) emitted.push({ eventType: rule.eventType, severity: rule.severity, metricKey: metric.metricKey, businessDate: metric.businessDate });
  }
  return { eventRows, emitted };
}

async function rebuildDerivedLayer(env, marketplace, productLimit, dateLimit) {
  const db = env.CORE_DB;
  const computedAt = nowIso();
  const products = await selectProductsForDerivedBuild(db, marketplace, productLimit);
  let stateRows = 0;
  let metricRows = 0;
  let eventRows = 0;
  const productResults = [];

  for (const product of products) {
    const dates = await selectProductDates(db, product.product_id, dateLimit);
    for (const businessDate of dates) {
      const inputs = await loadDailyInputs(db, product, businessDate);
      const state = buildDailyState(product, businessDate, inputs);
      await upsertDailyState(db, state, computedAt);
      stateRows += 1;
    }

    const metrics = await rebuildMetricsForProduct(db, product.product_id, product.marketplace, computedAt);
    metricRows += metrics.metricRows;
    const events = await emitLatestEvents(db, metrics.latestMetrics, computedAt);
    eventRows += events.eventRows;
    productResults.push({
      productId: product.product_id,
      asin: product.asin,
      datesBuilt: dates.length,
      metricsComputed: metrics.metricRows,
      eventsCreated: events.eventRows,
      emitted: events.emitted,
    });
  }

  const details = {
    engineVersion: ENGINE_VERSION,
    marketplace,
    productsProcessed: products.length,
    stateRows,
    metricRows,
    eventRows,
  };
  await db.prepare(`
    INSERT OR REPLACE INTO data_source_state (
      source_key, source_name, dataset, status, last_success_at, last_attempt_at,
      freshness_status, schema_version, parser_version, details_json, updated_at
    ) VALUES ('derived_layer_v1', '1122 Derived Layer', 'product_daily_state_metrics_events',
      'READY', ?, ?, 'FRESH', 'DerivedLayer.v1', ?, ?, datetime('now'))
  `).bind(computedAt, computedAt, ENGINE_VERSION, JSON.stringify(details)).run();

  await db.prepare(`
    INSERT INTO data_layer_audit (
      audit_id, action_type, object_type, object_id, actor, summary, metadata_json, occurred_at
    ) VALUES (?, 'DERIVED_REBUILD', 'pipeline', 'derived_layer_v1', '1122-data-layer-worker', ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    `Derived Layer rebuilt for ${products.length} product(s)`,
    JSON.stringify(details),
    computedAt
  ).run();

  return { ...details, products: productResults, computedAt };
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
        version: "1.2.0",
        storage: {
          d1: { role: "core-operating-facts", databaseName: "1122-core", ...d1 },
          r2: { role: "permanent-archive", ...r2 },
          kv: { role: "current-state-cache", existing: true, ready: true },
        },
        derivedLayer: {
          version: ENGINE_VERSION,
          pipeline: ["ProductDailyState", "Metric", "Event"],
          eventPolicy: "deterministic-rules-only",
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

    if (request.method === "POST" && url.pathname === "/internal/rebuild-derived") {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: "Unauthorized" }, 401, origin);
      if (!env.CORE_DB) return json({ success: false, message: "CORE_DB is not configured" }, 503, origin);
      try {
        const marketplace = String(url.searchParams.get("marketplace") || "US").toUpperCase();
        const productLimit = Math.min(Math.max(Number(url.searchParams.get("productLimit") || 5), 1), 20);
        const dateLimit = Math.min(Math.max(Number(url.searchParams.get("dateLimit") || 60), 7), 180);
        const result = await rebuildDerivedLayer(env, marketplace, productLimit, dateLimit);
        return json({ success: true, ...result }, 200, origin);
      } catch (error) {
        return json({ success: false, message: "Derived Layer rebuild failed", error: error.message }, 500, origin);
      }
    }

    return json({ success: false, message: "Endpoint not found" }, 404, origin);
  },
};
