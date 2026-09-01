import {
  planContextDomains,
  runS02,
  S02_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S02_上下文装载/执行程序/runtime.js';

export const A1_CONTEXT_LOADER_VERSION = 'a1-context-loader-v1.0.0';

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function iso(value) {
  const t = Date.parse(value || '');
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function ageHours(value, now = Date.now()) {
  const t = Date.parse(value || '');
  return Number.isFinite(t) ? Math.max(0, (now - t) / 3600000) : null;
}

function freshness(value, thresholdHours, now = Date.now()) {
  const age = ageHours(value, now);
  if (age === null) return 'unknown';
  return age <= thresholdHours ? 'fresh' : 'stale';
}

function maxIso(values) {
  let best = null;
  for (const value of values.filter(Boolean)) {
    const normalized = iso(value);
    if (!normalized) continue;
    if (!best || normalized > best) best = normalized;
  }
  return best;
}

function startDateFromEvent(event, days = 30) {
  const t = Date.parse(event?.occurred_at || '');
  const base = Number.isFinite(t) ? t : Date.now();
  return new Date(base - days * 86400000).toISOString().slice(0, 10);
}

function queryRows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function firstRow(result) {
  return queryRows(result)[0] || null;
}

function addQuery(queries, label, stmt) {
  queries.push({ label, stmt });
}

function eventCategory(eventType = '') {
  const t = String(eventType).toUpperCase();
  if (/INVENTORY|STOCK|OUT_OF_STOCK|COVERAGE/.test(t)) return 'inventory';
  if (/PRICE|BD|LD|DEAL|COUPON|PROMOTION/.test(t)) return 'price';
  if (/CONVERSION|CVR|ORDER_RATE/.test(t)) return 'conversion';
  if (/SESSIONS|NATURAL_TRAFFIC|MARKET_TRAFFIC|AD_TRAFFIC|RANK|BSR|TRAFFIC/.test(t)) return 'traffic';
  if (/LISTING|COMPLIANCE|FROZEN|SUPPRESSED/.test(t)) return 'compliance';
  return 'general';
}

function relevantMetricKeys(eventType = '') {
  const category = eventCategory(eventType);
  const common = ['product.price', 'amazon.sales', 'amazon.units', 'amazon.sessions', 'amazon.conversion_rate'];
  if (category === 'inventory') return [...common, 'inventory.fulfillable', 'inventory.coverage_days'];
  if (category === 'price') return [...common, 'inventory.coverage_days', 'sif.total_traffic_score', 'sif.bsr'];
  if (category === 'conversion') return [...common, 'sif.total_traffic_score', 'sif.natural_traffic_score', 'sif.bsr'];
  if (category === 'traffic') return [...common, 'sif.total_traffic_score', 'sif.natural_traffic_score', 'sif.ad_traffic_score', 'sif.bsr'];
  return [...common, 'inventory.coverage_days', 'sif.total_traffic_score', 'sif.natural_traffic_score', 'sif.bsr'];
}

export function buildDefaultContextRequest(event = {}) {
  const category = eventCategory(event.event_type);
  const questions = {
    inventory: '判断当前库存风险是否需要干预，并确认库存、销量、放量背景、经营目标和正在执行任务之间的关系。',
    price: '判断当前价格变化或价格决策是否合理，并确认价格、转化、库存、活动背景、目标和限制之间的关系。',
    conversion: '判断转化下降是否需要干预，并区分流量质量、价格/活动、产品状态和历史基线的影响。',
    traffic: '判断流量下降是否需要干预，并区分自身流量变化、市场变化、经营背景和正在执行动作的影响。',
    compliance: '判断Listing或合规异常的经营影响，并确认当前状态、相关历史、任务和审批限制。',
    general: `判断 ${event.event_type || '当前事件'} 的经营影响、相关背景以及是否具备进入后续冲突检测所需的上下文。`,
  };
  return {
    question: questions[category] || questions.general,
    decision_dependency: '为 S03 冲突检测及后续 A1 决策提供最小充分上下文。',
    data_window: { current: 'latest', history_days: 30 },
    max_context_items: 100,
    max_context_tokens: 12000,
  };
}

function normalizeProduct(row) {
  if (!row) return null;
  return {
    ...row,
    listing_status: parseJson(row.listing_status_json, null),
    listing_status_json: undefined,
  };
}

function normalizeState(row) {
  if (!row) return null;
  return {
    ...row,
    completeness: parseJson(row.completeness_json, null),
    completeness_json: undefined,
  };
}

function normalizeEvent(row) {
  return {
    ...row,
    evidence: parseJson(row.evidence_json, null),
    payload: parseJson(row.payload_json, null),
    evidence_json: undefined,
    payload_json: undefined,
  };
}

function normalizePlan(row) {
  if (!row) return null;
  return {
    ...row,
    constraints: parseJson(row.constraints_json, null),
    constraints_json: undefined,
  };
}

function normalizeDecision(row) {
  return {
    ...row,
    evidence: parseJson(row.evidence_json, null),
    constraints: parseJson(row.constraints_json, null),
    evidence_json: undefined,
    constraints_json: undefined,
  };
}

function normalizeTask(row) {
  return {
    ...row,
    payload: parseJson(row.payload_json, null),
    payload_json: undefined,
  };
}

function normalizeSifProfile(row) {
  if (!row) return null;
  return {
    ...row,
    dimensions: parseJson(row.dimensions_json, null),
    package_dimensions: parseJson(row.package_dimensions_json, null),
    bsr: parseJson(row.bsr_json, null),
    item_highlights: parseJson(row.item_highlights_json, null),
    dimensions_json: undefined,
    package_dimensions_json: undefined,
    bsr_json: undefined,
    item_highlights_json: undefined,
  };
}

function normalizeSifKeyword(row) {
  return {
    ...row,
    channel_coverage: parseJson(row.channel_coverage_json, null),
    channel_coverage_json: undefined,
  };
}

function normalizeSifAd(row) {
  if (!row) return null;
  return {
    ...row,
    ad_types: parseJson(row.ad_types_json, null),
    ad_types_json: undefined,
  };
}

async function retrieveAvailableContext(env, event, plan, contextRequest = {}) {
  const db = env.CORE_DB;
  const productId = event.product_id || null;
  const asin = event.asin || null;
  const marketplace = event.metadata?.marketplace || event.scope_objects?.[0]?.marketplace || null;
  const startDate = startDateFromEvent(event, Number(contextRequest?.data_window?.history_days || 30));
  const planned = new Set(plan.map((x) => x.domain));
  const maxItems = Math.min(Math.max(Number(contextRequest.max_context_items || 100), 10), 300);
  const perDomain = Math.max(2, Math.floor(maxItems / Math.max(plan.length, 1)));
  const queries = [];

  if (planned.has('C01') && productId) {
    addQuery(queries, 'C01_product', db.prepare('SELECT * FROM products WHERE product_id = ? LIMIT 1').bind(productId));
  }
  if (planned.has('C02') && productId) {
    addQuery(queries, 'C02_state', db.prepare('SELECT * FROM product_daily_state WHERE product_id = ? ORDER BY business_date DESC LIMIT 1').bind(productId));
    addQuery(queries, 'C02_inventory', db.prepare('SELECT * FROM inventory_snapshots WHERE product_id = ? ORDER BY observed_at DESC LIMIT 1').bind(productId));
  }
  if (planned.has('C03') && productId) {
    addQuery(queries, 'C03_plan', db.prepare("SELECT * FROM product_operating_plans WHERE product_id = ? AND status='ACTIVE' ORDER BY updated_at DESC LIMIT 1").bind(productId));
    addQuery(queries, 'C03_goals', db.prepare(`SELECT g.* FROM product_plan_goals g JOIN product_operating_plans p ON p.plan_id=g.plan_id WHERE p.product_id=? AND p.status='ACTIVE' AND g.status='ACTIVE' ORDER BY g.updated_at DESC LIMIT ?`).bind(productId, perDomain));
  }
  if (planned.has('C04') && productId) {
    const metricKeys = relevantMetricKeys(event.event_type);
    const placeholders = metricKeys.map(() => '?').join(',');
    addQuery(queries, 'C04_metrics', db.prepare(`SELECT business_date, metric_key, metric_value, prior_value, baseline_7d, delta_abs, delta_pct, direction, signal, source, computed_at, engine_version FROM product_daily_metrics WHERE product_id=? AND business_date>=? AND metric_key IN (${placeholders}) ORDER BY business_date DESC, metric_key ASC LIMIT ?`).bind(productId, startDate, ...metricKeys, Math.max(perDomain * 3, 12)));
  }
  if (planned.has('C05') && productId) {
    addQuery(queries, 'C05_events', db.prepare('SELECT event_id, event_type, severity, source, event_status, processing_disposition, evidence_json, payload_json, occurred_at FROM events WHERE product_id=? AND occurred_at>=? ORDER BY occurred_at DESC LIMIT ?').bind(productId, `${startDate}T00:00:00Z`, perDomain));
    addQuery(queries, 'C05_stages', db.prepare('SELECT * FROM product_stage_history WHERE product_id=? AND effective_at>=? ORDER BY effective_at DESC LIMIT ?').bind(productId, `${startDate}T00:00:00Z`, Math.max(2, Math.floor(perDomain / 2))));
  }
  if (planned.has('C06') && productId) {
    const stateLimit = Math.max(2, Math.floor(perDomain * 0.7));
    const salesLimit = Math.max(1, perDomain - stateLimit);
    addQuery(queries, 'C06_states', db.prepare('SELECT business_date, stage, price, sales, units, orders_count, sessions, page_views, conversion_rate, fulfillable_inventory, inbound_inventory, coverage_days, rating, review_count, primary_goal, market_total_score, market_natural_score, market_ad_score, bsr, data_quality_status, observed_at FROM product_daily_state WHERE product_id=? AND business_date>=? ORDER BY business_date DESC LIMIT ?').bind(productId, startDate, stateLimit));
    addQuery(queries, 'C06_sales', db.prepare('SELECT period_key, interval_start, interval_end, total_sales, currency, order_count, order_item_count, unit_count, average_unit_price, observed_at, source FROM sales_period_snapshots WHERE product_id=? ORDER BY observed_at DESC LIMIT ?').bind(productId, salesLimit));
  }
  if (planned.has('C08') && (productId || asin)) {
    const trafficLimit = Math.max(2, Math.floor(perDomain * 0.5));
    const keywordLimit = Math.max(2, perDomain - trafficLimit - 2);
    if (productId) {
      addQuery(queries, 'C08_traffic', db.prepare('SELECT * FROM sif_asin_traffic_daily WHERE product_id=? AND business_date>=? ORDER BY business_date DESC LIMIT ?').bind(productId, startDate, trafficLimit));
      addQuery(queries, 'C08_keywords', db.prepare('SELECT * FROM sif_asin_keyword_signals WHERE product_id=? ORDER BY observed_at DESC, traffic_share DESC LIMIT ?').bind(productId, keywordLimit));
      addQuery(queries, 'C08_profile', db.prepare('SELECT * FROM sif_asin_profile_snapshots WHERE product_id=? ORDER BY observed_at DESC LIMIT 1').bind(productId));
      addQuery(queries, 'C08_ad', db.prepare('SELECT * FROM sif_asin_ad_structure_snapshots WHERE product_id=? ORDER BY observed_at DESC LIMIT 1').bind(productId));
    } else if (asin && marketplace) {
      addQuery(queries, 'C08_traffic', db.prepare('SELECT * FROM sif_asin_traffic_daily WHERE marketplace=? AND asin=? AND business_date>=? ORDER BY business_date DESC LIMIT ?').bind(marketplace, asin, startDate, trafficLimit));
      addQuery(queries, 'C08_keywords', db.prepare('SELECT * FROM sif_asin_keyword_signals WHERE marketplace=? AND asin=? ORDER BY observed_at DESC, traffic_share DESC LIMIT ?').bind(marketplace, asin, keywordLimit));
      addQuery(queries, 'C08_profile', db.prepare('SELECT * FROM sif_asin_profile_snapshots WHERE marketplace=? AND asin=? ORDER BY observed_at DESC LIMIT 1').bind(marketplace, asin));
      addQuery(queries, 'C08_ad', db.prepare('SELECT * FROM sif_asin_ad_structure_snapshots WHERE marketplace=? AND asin=? ORDER BY observed_at DESC LIMIT 1').bind(marketplace, asin));
    }
  }
  if (planned.has('C10') && productId) {
    addQuery(queries, 'C10_tasks', db.prepare("SELECT * FROM tasks WHERE product_id=? AND task_status NOT IN ('DONE','CANCELLED','FAILED') ORDER BY updated_at DESC LIMIT ?").bind(productId, Math.max(2, Math.floor(perDomain / 3))));
    addQuery(queries, 'C10_decisions', db.prepare('SELECT * FROM decisions WHERE product_id=? ORDER BY decided_at DESC LIMIT ?').bind(productId, Math.max(2, Math.floor(perDomain / 3))));
    addQuery(queries, 'C10_actions', db.prepare(`SELECT a.*, p.constraints_json, p.stage, p.primary_goal, p.version AS plan_version FROM product_plan_actions a JOIN product_operating_plans p ON p.plan_id=a.plan_id WHERE p.product_id=? AND p.status='ACTIVE' AND a.status NOT IN ('DONE','CANCELLED') ORDER BY a.priority ASC, a.updated_at DESC LIMIT ?`).bind(productId, Math.max(2, perDomain - Math.floor(perDomain / 3) * 2)));
  }

  const resultMap = new Map();
  if (queries.length) {
    const results = await db.batch(queries.map((q) => q.stmt));
    queries.forEach((q, index) => resultMap.set(q.label, results[index]));
  }

  const now = Date.now();
  const available = {};

  if (planned.has('C01')) {
    const product = normalizeProduct(firstRow(resultMap.get('C01_product')));
    available.C01 = product ? {
      status: 'loaded', freshness: freshness(product.source_observed_at || product.updated_at, 24 * 30, now),
      as_of: iso(product.source_observed_at || product.updated_at), source: product.source || 'products', item_count: 1,
      refs: [`d1:products:${product.product_id}`], data: product,
    } : { status: 'missing', reason: '产品身份未在 products 主数据中找到。', dependency_status: 'NOT_FOUND' };
  }

  if (planned.has('C02')) {
    const state = normalizeState(firstRow(resultMap.get('C02_state')));
    const inventory = firstRow(resultMap.get('C02_inventory'));
    const category = eventCategory(event.event_type);
    const stateAsOf = state?.observed_at || (state?.business_date ? `${state.business_date}T23:59:59Z` : null);
    const invAsOf = inventory?.observed_at || null;
    const asOf = maxIso([stateAsOf, invAsOf]);
    if (!state) {
      available.C02 = { status: 'missing', reason: '缺少 product_daily_state 当前经营状态。', dependency_status: 'NO_DAILY_STATE', suggested_action: 'refresh_context' };
    } else if (category === 'inventory' && !inventory) {
      available.C02 = {
        status: 'partial', reason: '库存事件缺少最新 inventory_snapshot，不能把缺失解释为库存=0。',
        freshness: freshness(stateAsOf, 48, now), as_of: asOf, source: 'D1', item_count: 1,
        refs: [`d1:product_daily_state:${productId}:${state.business_date}`], data: { current_state: state, inventory: null },
      };
    } else {
      const inventoryFreshness = inventory ? freshness(invAsOf, 36, now) : 'unknown';
      const stateFreshness = freshness(stateAsOf, 72, now);
      available.C02 = {
        status: 'loaded', freshness: stateFreshness === 'stale' || (category === 'inventory' && inventoryFreshness === 'stale') ? 'stale' : stateFreshness,
        as_of: asOf, source: 'D1', item_count: inventory ? 2 : 1,
        refs: [
          `d1:product_daily_state:${productId}:${state.business_date}`,
          ...(inventory ? [`d1:inventory_snapshots:${inventory.snapshot_id}`] : []),
        ],
        data: { current_state: state, inventory: inventory || null, inventory_freshness: inventoryFreshness },
      };
    }
  }

  if (planned.has('C03')) {
    const planRow = firstRow(resultMap.get('C03_plan'));
    const planData = normalizePlan(planRow);
    const goals = queryRows(resultMap.get('C03_goals'));
    available.C03 = planData ? {
      status: 'loaded', freshness: 'current', as_of: iso(planData.updated_at), source: 'operating_plan',
      item_count: 1 + goals.length, refs: [`d1:product_operating_plans:${planData.plan_id}`, ...goals.map((g) => `d1:product_plan_goals:${g.goal_id}`)],
      data: { active_plan: planData, goals },
    } : { status: 'missing', reason: '当前产品没有 ACTIVE operating plan，无法确认现行经营目标。', dependency_status: 'NO_ACTIVE_PLAN' };
  }

  if (planned.has('C04')) {
    const metrics = queryRows(resultMap.get('C04_metrics'));
    const asOf = maxIso(metrics.map((m) => m.computed_at || (m.business_date ? `${m.business_date}T23:59:59Z` : null)));
    available.C04 = metrics.length ? {
      status: 'loaded', freshness: freshness(asOf, 72, now), as_of: asOf, source: 'product_daily_metrics', item_count: metrics.length,
      refs: [`d1:product_daily_metrics:${productId}:${startDate}:latest`],
      data: { window_start: startDate, metric_keys: relevantMetricKeys(event.event_type), observations: metrics },
    } : { status: 'missing', reason: '没有找到与当前事件相关的派生指标。', dependency_status: 'NO_METRICS', suggested_action: 'refresh_context' };
  }

  if (planned.has('C05')) {
    const events = queryRows(resultMap.get('C05_events')).map(normalizeEvent);
    const stages = queryRows(resultMap.get('C05_stages'));
    const asOf = maxIso([...events.map((e) => e.occurred_at), ...stages.map((s) => s.effective_at)]);
    available.C05 = events.length || stages.length ? {
      status: 'loaded', freshness: 'current', as_of: asOf, source: 'events_and_stage_history', item_count: events.length + stages.length,
      refs: [`d1:events:${productId}:${startDate}:latest`, `d1:product_stage_history:${productId}:${startDate}:latest`],
      data: { recent_events: events, stage_history: stages, promotion_coverage: 'structured promotion calendar not yet available; only recorded events/actions are included' },
    } : { status: 'missing', reason: '没有读取到当前产品的近期事件或经营背景。', dependency_status: 'NO_EVENT_CONTEXT' };
  }

  if (planned.has('C06')) {
    const states = queryRows(resultMap.get('C06_states'));
    const sales = queryRows(resultMap.get('C06_sales'));
    const asOf = maxIso([...states.map((s) => s.observed_at || `${s.business_date}T23:59:59Z`), ...sales.map((s) => s.observed_at)]);
    available.C06 = states.length || sales.length ? {
      status: 'loaded', freshness: 'historical', as_of: asOf, source: 'D1_history', item_count: states.length + sales.length,
      refs: [`d1:product_daily_state:${productId}:${startDate}:history`, `d1:sales_period_snapshots:${productId}:recent`],
      data: { window_start: startDate, daily_state_history: states, sales_period_history: sales },
    } : { status: 'missing', reason: '产品历史尚未形成；无历史不等于系统错误。', dependency_status: 'NO_HISTORY' };
  }

  if (planned.has('C07')) {
    available.C07 = {
      status: 'missing', reason: '专业Agent结论尚未建立统一运行时存储索引；不能从仓库文档伪装成当前有效分析。',
      dependency_status: 'AGENT_ANALYSIS_STORE_NOT_READY', suggested_action: 'request_agent_analysis', freshness: 'unknown',
    };
  }

  if (planned.has('C08')) {
    const traffic = queryRows(resultMap.get('C08_traffic'));
    const keywords = queryRows(resultMap.get('C08_keywords')).map(normalizeSifKeyword);
    const profile = normalizeSifProfile(firstRow(resultMap.get('C08_profile')));
    const adStructure = normalizeSifAd(firstRow(resultMap.get('C08_ad')));
    const asOf = maxIso([
      ...traffic.map((x) => x.observed_at || (x.business_date ? `${x.business_date}T23:59:59Z` : null)),
      ...keywords.map((x) => x.observed_at), profile?.observed_at, adStructure?.observed_at,
    ]);
    const count = traffic.length + keywords.length + (profile ? 1 : 0) + (adStructure ? 1 : 0);
    available.C08 = count ? {
      status: 'loaded', freshness: freshness(asOf, 24 * 7, now), as_of: asOf, source: 'Sif MCP / D1', item_count: count,
      refs: [`d1:sif_asin_traffic_daily:${asin || productId}:${startDate}:latest`, `d1:sif_asin_keyword_signals:${asin || productId}:latest`, `d1:sif_asin_ad_structure_snapshots:${asin || productId}:latest`],
      data: { asin_profile: profile, traffic_history: traffic, keyword_signals: keywords, ad_structure: adStructure, competitor_scope: 'current product/ASIN intelligence only; competitor pool linkage is not yet materialized in D1' },
    } : { status: 'missing', reason: 'Sif 对该经营对象当前没有可用的市场/关键词/广告结构上下文。', dependency_status: 'NO_SIF_CONTEXT' };
  }

  if (planned.has('C09')) {
    available.C09 = {
      status: 'missing', reason: '经营知识尚未建立运行时 Knowledge Retriever；无知识匹配时允许继续基于事实推理。',
      dependency_status: 'KNOWLEDGE_RETRIEVER_NOT_READY', suggested_action: 'request_information', freshness: 'unknown',
    };
  }

  if (planned.has('C10')) {
    const tasks = queryRows(resultMap.get('C10_tasks')).map(normalizeTask);
    const decisions = queryRows(resultMap.get('C10_decisions')).map(normalizeDecision);
    const actions = queryRows(resultMap.get('C10_actions')).map((row) => ({
      ...row,
      constraints: parseJson(row.constraints_json, null),
      constraints_json: undefined,
    }));
    const asOf = maxIso([...tasks.map((x) => x.updated_at), ...decisions.map((x) => x.decided_at), ...actions.map((x) => x.updated_at)]);
    available.C10 = {
      status: 'loaded', freshness: asOf ? freshness(asOf, 24 * 7, now) : 'current', as_of: asOf || new Date(now).toISOString(),
      source: 'tasks_decisions_plan_actions', item_count: tasks.length + decisions.length + actions.length,
      refs: [`d1:tasks:${productId}:active`, `d1:decisions:${productId}:recent`, `d1:product_plan_actions:${productId}:active`],
      data: { active_tasks: tasks, recent_decisions: decisions, active_plan_actions_and_constraints: actions, empty_is_authoritative: true },
    };
  }

  return available;
}

async function persistContextRun(env, intakeRow, contextRequest, output) {
  const db = env.CORE_DB;
  const contextRunId = crypto.randomUUID();
  const loadedAt = new Date().toISOString();
  const statements = [
    db.prepare(`
      INSERT INTO a1_context_runs (
        context_run_id, intake_id, event_id, product_id, marketplace, question,
        context_request_json, planned_domains_json, context_package_json,
        loaded_items_json, missing_context_json, stale_context_json,
        excluded_context_json, context_refs_json, context_summary,
        s02_status, next_action, loader_version, loaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      contextRunId, intakeRow.intake_id, intakeRow.event_id, intakeRow.product_id || null,
      intakeRow.marketplace || null, output.question, JSON.stringify(contextRequest),
      JSON.stringify(output.planned_domains || []), JSON.stringify(output.context_package || {}),
      JSON.stringify(output.loaded_items || []), JSON.stringify(output.missing_context || []),
      JSON.stringify(output.stale_context || []), JSON.stringify(output.excluded_context || []),
      JSON.stringify(output.context_refs || []), output.context_summary || null,
      output.status, output.next_action, S02_RUNTIME_VERSION, loadedAt,
    ),
    db.prepare(`
      UPDATE data_source_state
      SET status=?, last_success_at=?, last_attempt_at=?, freshness_status=?, parser_version=?, details_json=?, updated_at=datetime('now')
      WHERE source_key='a1_context_loader'
    `).bind(
      ['ready', 'ready_with_gaps'].includes(output.status) ? 'READY' : 'ATTENTION',
      ['ready', 'ready_with_gaps'].includes(output.status) ? loadedAt : null,
      loadedAt,
      output.status === 'ready' ? 'FRESH' : output.status === 'ready_with_gaps' ? 'PARTIAL' : 'REVIEW',
      S02_RUNTIME_VERSION,
      JSON.stringify({ last_event_id: intakeRow.event_id, last_context_run_id: contextRunId, s02_status: output.status, next_action: output.next_action, loader_version: A1_CONTEXT_LOADER_VERSION }),
    ),
  ];
  await db.batch(statements);
  return contextRunId;
}

async function loadIntakeById(db, intakeId) {
  return db.prepare(`
    SELECT * FROM a1_event_intake_runs
    WHERE intake_id=? AND intake_status='READY_FOR_S02' AND normalized_event_json IS NOT NULL
    LIMIT 1
  `).bind(intakeId).first();
}

export async function loadContextForIntake(env, intakeId, options = {}) {
  if (!env.CORE_DB) throw new Error('CORE_DB is not configured');
  const intake = await loadIntakeById(env.CORE_DB, intakeId);
  if (!intake) return { found: false, intakeId };

  const event = parseJson(intake.normalized_event_json, null);
  const s01Output = parseJson(intake.s01_output_json, {});
  if (!event) return { found: false, intakeId, reason: 'normalized_event_json is invalid' };
  const contextRequest = { ...buildDefaultContextRequest(event), ...(options.contextRequest || {}) };
  const plan = planContextDomains(event, contextRequest);
  const availableContext = await retrieveAvailableContext(env, event, plan, contextRequest);
  const output = runS02({
    validated_event: event,
    s01_validation: {
      status: s01Output.status,
      warnings: s01Output.warnings || [],
      duplicate_signal: s01Output.duplicate_signal || {},
      validation_summary: s01Output.validation_summary || null,
      validator_version: s01Output.validator_version || intake.validator_version || null,
    },
    context_request: contextRequest,
    available_context: availableContext,
    current_time: new Date().toISOString(),
  });
  const contextRunId = await persistContextRun(env, intake, contextRequest, output);
  return {
    found: true,
    contextRunId,
    intakeId: intake.intake_id,
    eventId: intake.event_id,
    loaderVersion: A1_CONTEXT_LOADER_VERSION,
    runtimeVersion: S02_RUNTIME_VERSION,
    ...output,
  };
}

export async function loadContextForEvent(env, eventId, options = {}) {
  const intake = await env.CORE_DB.prepare(`
    SELECT intake_id FROM a1_event_intake_runs
    WHERE event_id=? AND intake_status='READY_FOR_S02' AND normalized_event_json IS NOT NULL
    ORDER BY validated_at DESC LIMIT 1
  `).bind(eventId).first();
  if (!intake) return { found: false, eventId };
  return loadContextForIntake(env, intake.intake_id, options);
}

export async function loadPendingContexts(env, options = {}) {
  const db = env.CORE_DB;
  if (!db) throw new Error('CORE_DB is not configured');
  const limit = Math.min(Math.max(Number(options.limit || 10), 1), 10);
  const result = await db.prepare(`
    SELECT i.intake_id
    FROM a1_event_intake_runs i
    LEFT JOIN a1_context_runs c
      ON c.intake_id=i.intake_id AND c.loader_version=?
    WHERE i.intake_status='READY_FOR_S02'
      AND i.normalized_event_json IS NOT NULL
      AND c.context_run_id IS NULL
    ORDER BY i.validated_at ASC
    LIMIT ?
  `).bind(S02_RUNTIME_VERSION, limit).all();

  const outcomes = [];
  for (const row of result?.results || []) {
    outcomes.push(await loadContextForIntake(env, row.intake_id, options));
  }
  return {
    loaderVersion: A1_CONTEXT_LOADER_VERSION,
    runtimeVersion: S02_RUNTIME_VERSION,
    selected: Number(result?.results?.length || 0),
    processed: outcomes.length,
    ready: outcomes.filter((x) => x.status === 'ready').length,
    readyWithGaps: outcomes.filter((x) => x.status === 'ready_with_gaps').length,
    needsInformation: outcomes.filter((x) => x.status === 'needs_information').length,
    blocked: outcomes.filter((x) => x.status === 'blocked').length,
    outcomes,
  };
}
