const ENGINE_VERSION = "derived-v1.1";
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

function dateMs(value) {
  const t = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(t) ? t : 0;
}

async function runBatches(db, statements, size = 80) {
  const results = [];
  for (let i = 0; i < statements.length; i += size) {
    const chunk = statements.slice(i, i + size);
    if (chunk.length) results.push(...await db.batch(chunk));
  }
  return results;
}

function latestByDate(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = String(row.business_date || "");
    if (key && !map.has(key)) map.set(key, row);
  }
  return map;
}

async function selectProducts(db, marketplace, limit) {
  const result = await db.prepare(`
    SELECT p.product_id, p.marketplace, p.asin, p.listing_price, p.regular_price, p.currency
    FROM products p
    WHERE p.marketplace = ?
      AND p.asin IS NOT NULL AND p.asin <> ''
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

async function selectDates(db, productId, dateLimit) {
  const result = await db.prepare(`
    SELECT business_date FROM (
      SELECT business_date FROM traffic_daily WHERE product_id = ?
      UNION
      SELECT business_date FROM sif_asin_traffic_daily WHERE product_id = ?
    )
    ORDER BY business_date DESC LIMIT ?
  `).bind(productId, productId, dateLimit).all();
  return (result?.results || []).map((r) => String(r.business_date)).sort();
}

async function loadProductData(db, product, dates) {
  if (!dates.length) return { amazon: new Map(), sif: new Map(), inventory: [], plan: null };
  const start = dates[0];
  const end = dates[dates.length - 1];
  const [amazonResult, sifResult, inventoryBaseline, inventoryRange, plan] = await Promise.all([
    db.prepare(`SELECT * FROM traffic_daily WHERE product_id = ? AND business_date BETWEEN ? AND ? ORDER BY business_date ASC, observed_at DESC`)
      .bind(product.product_id, start, end).all(),
    db.prepare(`SELECT * FROM sif_asin_traffic_daily WHERE product_id = ? AND business_date BETWEEN ? AND ? ORDER BY business_date ASC, observed_at DESC`)
      .bind(product.product_id, start, end).all(),
    db.prepare(`SELECT * FROM inventory_snapshots WHERE product_id = ? AND substr(observed_at,1,10) < ? ORDER BY observed_at DESC LIMIT 1`)
      .bind(product.product_id, start).first(),
    db.prepare(`SELECT * FROM inventory_snapshots WHERE product_id = ? AND substr(observed_at,1,10) BETWEEN ? AND ? ORDER BY observed_at ASC`)
      .bind(product.product_id, start, end).all(),
    db.prepare(`SELECT stage, primary_goal, version FROM product_operating_plans WHERE product_id = ? AND status = 'ACTIVE' ORDER BY updated_at DESC LIMIT 1`)
      .bind(product.product_id).first(),
  ]);

  const inventory = [];
  if (inventoryBaseline) inventory.push(inventoryBaseline);
  inventory.push(...(inventoryRange?.results || []));
  inventory.sort((a, b) => String(a.observed_at).localeCompare(String(b.observed_at)));

  return {
    amazon: latestByDate(amazonResult?.results || []),
    sif: latestByDate(sifResult?.results || []),
    inventory,
    plan,
  };
}

function buildStates(product, dates, source) {
  const states = [];
  let inventoryIndex = -1;
  let activeInventory = null;
  const unitHistory = [];

  for (const businessDate of dates) {
    while (inventoryIndex + 1 < source.inventory.length && String(source.inventory[inventoryIndex + 1].observed_at).slice(0, 10) <= businessDate) {
      inventoryIndex += 1;
      activeInventory = source.inventory[inventoryIndex];
    }

    const amazon = source.amazon.get(businessDate) || null;
    const sif = source.sif.get(businessDate) || null;
    const units = asInteger(amazon?.units_ordered);
    const sessions = asInteger(amazon?.sessions);
    const conversionRate = sessions && sessions > 0 && units !== null ? units / sessions : null;

    const cutoff = dateMs(businessDate) - 7 * 86400000;
    const recentUnits = unitHistory.filter((x) => x.ms >= cutoff && x.ms < dateMs(businessDate) && Number.isFinite(x.units));
    const avgUnits = average(recentUnits.map((x) => x.units));
    const fulfillable = asInteger(activeInventory?.fulfillable_quantity);
    const coverageDays = fulfillable !== null && avgUnits && avgUnits > 0 ? fulfillable / avgUnits : null;
    const inboundFallback =
      (asNumber(activeInventory?.inbound_working_quantity) || 0) +
      (asNumber(activeInventory?.inbound_shipped_quantity) || 0) +
      (asNumber(activeInventory?.inbound_receiving_quantity) || 0);
    const inbound = firstNumber(activeInventory?.inbound_total_quantity, inboundFallback);

    const sourcePresence = {
      amazonTraffic: Boolean(amazon),
      sifTraffic: Boolean(sif),
      inventory: Boolean(activeInventory),
      operatingPlan: Boolean(source.plan),
    };
    const sourceCount = Object.values(sourcePresence).filter(Boolean).length;
    const dataQualityStatus = sourceCount >= 3 ? "FULL" : sourceCount >= 2 ? "PARTIAL" : "LIMITED";

    states.push({
      product_id: product.product_id,
      marketplace: product.marketplace,
      business_date: businessDate,
      stage: source.plan?.stage ?? null,
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
      primary_goal: source.plan?.primary_goal ?? null,
      strategy_version: asInteger(source.plan?.version),
      market_total_score: asNumber(sif?.total_score),
      market_natural_score: asNumber(sif?.natural_score),
      market_ad_score: asNumber(sif?.ad_score),
      bsr: asInteger(sif?.bsr),
      data_quality_status: dataQualityStatus,
      completeness_json: JSON.stringify({
        sources: sourcePresence,
        missing: Object.entries(sourcePresence).filter(([, v]) => !v).map(([k]) => k),
      }),
    });

    if (Number.isFinite(units)) unitHistory.push({ ms: dateMs(businessDate), units });
  }
  return states;
}

async function persistStates(db, states, observedAt) {
  const statements = states.map((state) => db.prepare(`
    INSERT INTO product_daily_state (
      product_daily_state_id, product_id, marketplace, business_date, stage, price, sales, units,
      orders_count, sessions, page_views, conversion_rate, ad_spend, ad_sales, acos, tacos,
      fulfillable_inventory, inbound_inventory, coverage_days, rating, review_count,
      contribution_profit, profit_margin, primary_goal, strategy_version, completeness_json,
      observed_at, market_total_score, market_natural_score, market_ad_score, bsr, data_quality_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(product_id, business_date) DO UPDATE SET
      marketplace=excluded.marketplace, stage=excluded.stage, price=excluded.price,
      sales=excluded.sales, units=excluded.units, orders_count=excluded.orders_count,
      sessions=excluded.sessions, page_views=excluded.page_views, conversion_rate=excluded.conversion_rate,
      fulfillable_inventory=excluded.fulfillable_inventory, inbound_inventory=excluded.inbound_inventory,
      coverage_days=excluded.coverage_days, rating=excluded.rating, review_count=excluded.review_count,
      primary_goal=excluded.primary_goal, strategy_version=excluded.strategy_version,
      completeness_json=excluded.completeness_json, observed_at=excluded.observed_at,
      market_total_score=excluded.market_total_score, market_natural_score=excluded.market_natural_score,
      market_ad_score=excluded.market_ad_score, bsr=excluded.bsr,
      data_quality_status=excluded.data_quality_status
  `).bind(
    crypto.randomUUID(), state.product_id, state.marketplace, state.business_date, state.stage,
    state.price, state.sales, state.units, state.orders_count, state.sessions, state.page_views,
    state.conversion_rate, state.ad_spend, state.ad_sales, state.acos, state.tacos,
    state.fulfillable_inventory, state.inbound_inventory, state.coverage_days, state.rating,
    state.review_count, state.contribution_profit, state.profit_margin, state.primary_goal,
    state.strategy_version, state.completeness_json, observedAt, state.market_total_score,
    state.market_natural_score, state.market_ad_score, state.bsr, state.data_quality_status
  ));
  await runBatches(db, statements);
  return statements.length;
}

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

function buildMetrics(states, computedAt) {
  const histories = new Map();
  const rows = [];
  const latestMetrics = new Map();

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
      const row = {
        productId: state.product_id,
        marketplace: state.marketplace,
        businessDate: state.business_date,
        metricKey,
        value,
        prior,
        baseline,
        deltaAbs,
        deltaPct,
        direction,
        signal,
        source,
        computedAt,
        historyCount: baselineValues.length,
      };
      rows.push(row);
      latestMetrics.set(metricKey, row);
      if (Number.isFinite(value)) {
        history.push(value);
        histories.set(metricKey, history);
      }
    }
  }
  return { rows, latestMetrics };
}

async function persistMetrics(db, metrics) {
  const statements = metrics.map((m) => db.prepare(`
    INSERT INTO product_daily_metrics (
      metric_id, product_id, marketplace, business_date, metric_key, metric_value,
      prior_value, baseline_7d, delta_abs, delta_pct, direction, signal, source,
      computed_at, engine_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(product_id, business_date, metric_key) DO UPDATE SET
      metric_value=excluded.metric_value, prior_value=excluded.prior_value,
      baseline_7d=excluded.baseline_7d, delta_abs=excluded.delta_abs,
      delta_pct=excluded.delta_pct, direction=excluded.direction, signal=excluded.signal,
      source=excluded.source, computed_at=excluded.computed_at, engine_version=excluded.engine_version
  `).bind(
    crypto.randomUUID(), m.productId, m.marketplace, m.businessDate, m.metricKey,
    m.value, m.prior, m.baseline, m.deltaAbs, m.deltaPct, m.direction, m.signal,
    m.source, m.computedAt, ENGINE_VERSION
  ));
  await runBatches(db, statements);
  return statements.length;
}

function eventRule(metric) {
  const { metricKey, value, prior, baseline, deltaPct, historyCount } = metric;
  if (metricKey === "inventory.coverage_days" && Number.isFinite(value) && value <= 7) {
    return { eventType: "INVENTORY_COVERAGE_LOW", severity: value <= 3 ? "HIGH" : "MEDIUM", threshold: { coverageDaysLte: 7, criticalLte: 3 } };
  }
  if (metricKey === "product.price" && Number.isFinite(value) && Number.isFinite(prior) && prior !== 0) {
    const changePct = (value - prior) / Math.abs(prior);
    if (Math.abs(changePct) >= 0.05) {
      return { eventType: "PRICE_CHANGE", severity: Math.abs(changePct) >= 0.1 ? "HIGH" : "MEDIUM", threshold: { absoluteChangePctGte: 0.05 }, overrideDeltaPct: changePct };
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
      return { eventType, severity: deltaPct <= threshold - 0.15 ? "HIGH" : "MEDIUM", threshold: { deltaPctLte: threshold } };
    }
  }
  if (metricKey === "sif.bsr" && deltaPct >= 0.25) {
    return { eventType: "BSR_DETERIORATION", severity: deltaPct >= 0.40 ? "HIGH" : "MEDIUM", threshold: { deltaPctGte: 0.25 } };
  }
  return null;
}

async function emitEvents(db, latestMetrics) {
  const statements = [];
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
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO events (
        event_id, product_id, marketplace, event_type, severity, source, event_status,
        processing_disposition, evidence_json, payload_json, occurred_at, dedup_key
      ) VALUES (?, ?, ?, ?, ?, 'derived_layer_v1', 'NEW', 'AWAITING_A1', ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), metric.productId, metric.marketplace, rule.eventType, rule.severity,
      JSON.stringify(evidence), JSON.stringify({ engineVersion: ENGINE_VERSION, deterministic: true }),
      `${metric.businessDate}T23:59:59Z`, dedupKey
    ));
    emitted.push({ eventType: rule.eventType, severity: rule.severity, metricKey: metric.metricKey, businessDate: metric.businessDate });
  }
  const results = await runBatches(db, statements);
  const inserted = results.reduce((sum, r) => sum + Number(r?.meta?.changes || 0), 0);
  return { inserted, emitted: inserted ? emitted : [] };
}

export async function rebuildDerivedLayer(env, marketplace = "US", productLimit = 5, dateLimit = 60) {
  const db = env.CORE_DB;
  const computedAt = nowIso();
  const products = await selectProducts(db, marketplace, productLimit);
  let stateRows = 0;
  let metricRows = 0;
  let eventRows = 0;
  const productResults = [];

  for (const product of products) {
    const dates = await selectDates(db, product.product_id, dateLimit);
    const source = await loadProductData(db, product, dates);
    const states = buildStates(product, dates, source);
    stateRows += await persistStates(db, states, computedAt);

    const metricBuild = buildMetrics(states, computedAt);
    metricRows += await persistMetrics(db, metricBuild.rows);
    const eventBuild = await emitEvents(db, metricBuild.latestMetrics);
    eventRows += eventBuild.inserted;

    productResults.push({
      productId: product.product_id,
      asin: product.asin,
      datesBuilt: states.length,
      metricsComputed: metricBuild.rows.length,
      eventsCreated: eventBuild.inserted,
      emitted: eventBuild.emitted,
    });
  }

  const details = { engineVersion: ENGINE_VERSION, marketplace, productsProcessed: products.length, stateRows, metricRows, eventRows };
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
  `).bind(crypto.randomUUID(), `Derived Layer rebuilt for ${products.length} product(s)`, JSON.stringify(details), computedAt).run();

  return { ...details, products: productResults, computedAt };
}

export const DERIVED_ENGINE_VERSION = ENGINE_VERSION;
