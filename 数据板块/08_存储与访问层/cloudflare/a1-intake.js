import {
  validateS01,
  S01_VALIDATOR_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S01_事件校验/执行程序/runtime.js';

export const A1_INTAKE_VERSION = 'a1-intake-v1.0.0';

const SEVERITY_MAP = new Map([
  ['CRITICAL', 'P0'],
  ['HIGH', 'P1'],
  ['MEDIUM', 'P2'],
  ['LOW', 'P3'],
  ['INFO', 'P3'],
  ['P0', 'P0'],
  ['P1', 'P1'],
  ['P2', 'P2'],
  ['P3', 'P3'],
]);

function parseJson(value, fallback = {}) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(value) {
  const n = asNumber(value);
  if (n === null) return '无有效数值';
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return String(Math.round(n * 10000) / 10000);
}

function formatPct(value) {
  const n = asNumber(value);
  if (n === null) return '无有效变化率';
  return `${Math.round(n * 10000) / 100}%`;
}

function severityToCanonical(value) {
  return SEVERITY_MAP.get(String(value || '').toUpperCase()) || 'P2';
}

function buildFacts(rawEvent, evidence) {
  const facts = [];
  const metricKey = String(evidence?.metricKey || '').trim();
  const current = asNumber(evidence?.currentValue);
  const baseline = asNumber(evidence?.baseline7d);
  const prior = asNumber(evidence?.priorValue);
  const deltaPct = asNumber(evidence?.deltaPct);

  if (metricKey) {
    facts.push(
      `${metricKey} 当前值 ${formatNumber(current)}，7日基线 ${formatNumber(baseline)}，相对基线变化 ${formatPct(deltaPct)}。`,
    );
  }
  if (prior !== null) {
    facts.push(`${metricKey || '该指标'} 前一观测值为 ${formatNumber(prior)}。`);
  }
  if (evidence?.threshold && typeof evidence.threshold === 'object') {
    facts.push(`确定性规则阈值：${JSON.stringify(evidence.threshold)}。`);
  }
  if (Number.isFinite(Number(evidence?.historyPoints))) {
    facts.push(`当前基线使用 ${Number(evidence.historyPoints)} 个历史观测点。`);
  }
  if (!facts.length) {
    facts.push(
      `事件 ${rawEvent.event_type} 由 ${rawEvent.source || 'unknown'} 于 ${rawEvent.occurred_at} 写入经营事件库。`,
    );
  }
  return facts;
}

function buildSummary(rawEvent, product, evidence) {
  const identity = product?.asin || rawEvent.product_id || rawEvent.marketplace || '经营对象';
  const metricKey = String(evidence?.metricKey || '').trim();
  const deltaPct = asNumber(evidence?.deltaPct);
  const suffix = metricKey
    ? `${metricKey}${deltaPct === null ? '' : ` 相对7日基线变化 ${formatPct(deltaPct)}`}`
    : '确定性经营规则被触发';
  return `${identity} 触发 ${rawEvent.event_type}：${suffix}。`;
}

export function buildCanonicalEvent(rawEvent, product = null, receivedAt = new Date().toISOString()) {
  const evidence = parseJson(rawEvent.evidence_json, {});
  const payload = parseJson(rawEvent.payload_json, {});
  const productId = rawEvent.product_id || product?.product_id || null;
  const asin = product?.asin || null;
  const scopeType = productId ? 'product' : rawEvent.marketplace ? 'store' : 'global';
  const scopeObjects = [];

  if (productId) {
    scopeObjects.push({
      object_type: 'product',
      product_id: productId,
      asin,
      marketplace: rawEvent.marketplace || product?.marketplace || null,
    });
  } else if (rawEvent.marketplace) {
    scopeObjects.push({ object_type: 'store', marketplace: rawEvent.marketplace });
  }

  return {
    event_id: String(rawEvent.event_id),
    source_type: 'system',
    source_agent: null,
    source_actor: '1122-derived-layer',
    source_ref: String(rawEvent.event_id),
    event_type: String(rawEvent.event_type),
    scope_type: scopeType,
    scope_id: productId || rawEvent.marketplace || '1122',
    scope_objects: scopeObjects,
    product_id: productId,
    asin,
    severity: severityToCanonical(rawEvent.severity),
    occurred_at: new Date(rawEvent.occurred_at).toISOString(),
    received_at: receivedAt,
    summary: buildSummary(rawEvent, product, evidence),
    facts: buildFacts(rawEvent, evidence),
    metrics: {
      metric_key: evidence.metricKey ?? null,
      current_value: evidence.currentValue ?? null,
      prior_value: evidence.priorValue ?? null,
      baseline_7d: evidence.baseline7d ?? null,
      delta_pct: evidence.deltaPct ?? null,
      history_points: evidence.historyPoints ?? null,
      threshold: evidence.threshold ?? null,
    },
    confidence: payload?.deterministic === true ? 1 : 0.9,
    evidence_refs: [
      `d1:events:${rawEvent.event_id}`,
      ...(productId && evidence.metricKey
        ? [`d1:product_daily_metrics:${productId}:${evidence.metricKey}:${String(rawEvent.occurred_at).slice(0, 10)}`]
        : []),
    ],
    related_events: [],
    parent_event_id: null,
    requires_decision_by: null,
    data_window: evidence.metricKey ? 'current observation vs 7-day baseline' : null,
    attachments: [],
    metadata: {
      marketplace: rawEvent.marketplace || product?.marketplace || null,
      raw_event: {
        source: rawEvent.source || null,
        severity: rawEvent.severity || null,
        event_status: rawEvent.event_status || null,
        processing_disposition: rawEvent.processing_disposition || null,
      },
      derived_payload: payload,
      intake_version: A1_INTAKE_VERSION,
    },
  };
}

async function loadProduct(db, productId) {
  if (!productId) return null;
  return db.prepare(
    'SELECT product_id, marketplace, asin FROM products WHERE product_id = ? LIMIT 1',
  ).bind(productId).first();
}

async function loadExistingEvents(db, productId, currentEventId) {
  try {
    const query = productId
      ? db.prepare(`
          SELECT event_id, normalized_event_json
          FROM a1_event_intake_runs
          WHERE product_id = ? AND event_id <> ? AND normalized_event_json IS NOT NULL
          ORDER BY validated_at DESC LIMIT 20
        `).bind(productId, currentEventId)
      : db.prepare(`
          SELECT event_id, normalized_event_json
          FROM a1_event_intake_runs
          WHERE event_id <> ? AND normalized_event_json IS NOT NULL
          ORDER BY validated_at DESC LIMIT 20
        `).bind(currentEventId);
    const result = await query.all();
    return (result?.results || [])
      .map((row) => parseJson(row.normalized_event_json, null))
      .filter((row) => row && typeof row === 'object');
  } catch {
    return [];
  }
}

function intakeStatusFor(s01Status) {
  if (s01Status === 'passed' || s01Status === 'passed_with_warnings') return 'READY_FOR_S02';
  if (s01Status === 'needs_information') return 'NEEDS_INFORMATION';
  return 'BLOCKED';
}

async function persistIntake(db, rawEvent, canonicalEvent, s01Input, s01Output, receivedAt) {
  const intakeId = `a1:${rawEvent.event_id}:${S01_VALIDATOR_VERSION}`;
  const intakeStatus = intakeStatusFor(s01Output.status);
  const validatedAt = new Date().toISOString();

  await db.prepare(`
    INSERT INTO a1_event_intake_runs (
      intake_id, event_id, product_id, marketplace, source,
      canonical_event_json, s01_input_json, s01_output_json,
      s01_status, next_action, normalized_event_json,
      blocking_errors_json, warnings_json, duplicate_signal_json,
      intake_status, validator_version, received_at, validated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_id, validator_version) DO UPDATE SET
      product_id=excluded.product_id,
      marketplace=excluded.marketplace,
      source=excluded.source,
      canonical_event_json=excluded.canonical_event_json,
      s01_input_json=excluded.s01_input_json,
      s01_output_json=excluded.s01_output_json,
      s01_status=excluded.s01_status,
      next_action=excluded.next_action,
      normalized_event_json=excluded.normalized_event_json,
      blocking_errors_json=excluded.blocking_errors_json,
      warnings_json=excluded.warnings_json,
      duplicate_signal_json=excluded.duplicate_signal_json,
      intake_status=excluded.intake_status,
      received_at=excluded.received_at,
      validated_at=excluded.validated_at
  `).bind(
    intakeId,
    rawEvent.event_id,
    rawEvent.product_id || null,
    rawEvent.marketplace || null,
    rawEvent.source || null,
    JSON.stringify(canonicalEvent),
    JSON.stringify(s01Input),
    JSON.stringify(s01Output),
    s01Output.status,
    s01Output.next_action,
    s01Output.normalized_event ? JSON.stringify(s01Output.normalized_event) : null,
    JSON.stringify(s01Output.blocking_errors || []),
    JSON.stringify(s01Output.warnings || []),
    JSON.stringify(s01Output.duplicate_signal || {}),
    intakeStatus,
    S01_VALIDATOR_VERSION,
    receivedAt,
    validatedAt,
  ).run();

  await db.prepare(`
    UPDATE data_source_state
    SET status = ?, last_success_at = ?, last_attempt_at = ?, freshness_status = ?,
        parser_version = ?, details_json = ?, updated_at = datetime('now')
    WHERE source_key = 'a1_event_intake'
  `).bind(
    intakeStatus === 'READY_FOR_S02' ? 'READY' : 'ATTENTION',
    intakeStatus === 'READY_FOR_S02' ? validatedAt : null,
    validatedAt,
    intakeStatus === 'READY_FOR_S02' ? 'FRESH' : 'REVIEW',
    S01_VALIDATOR_VERSION,
    JSON.stringify({
      last_event_id: rawEvent.event_id,
      last_s01_status: s01Output.status,
      next_action: s01Output.next_action,
      intake_version: A1_INTAKE_VERSION,
    }),
  ).run();

  return {
    intakeId,
    eventId: rawEvent.event_id,
    s01Status: s01Output.status,
    nextAction: s01Output.next_action,
    intakeStatus,
    validatorVersion: S01_VALIDATOR_VERSION,
    normalizedEvent: s01Output.normalized_event,
    warnings: s01Output.warnings || [],
    blockingErrors: s01Output.blocking_errors || [],
  };
}

export async function intakeEventById(env, eventId) {
  const db = env.CORE_DB;
  if (!db) throw new Error('CORE_DB is not configured');
  const rawEvent = await db.prepare('SELECT * FROM events WHERE event_id = ? LIMIT 1').bind(eventId).first();
  if (!rawEvent) return { found: false, eventId };

  const receivedAt = new Date().toISOString();
  const product = await loadProduct(db, rawEvent.product_id);
  const canonicalEvent = buildCanonicalEvent(rawEvent, product, receivedAt);
  const existingEvents = await loadExistingEvents(db, rawEvent.product_id, rawEvent.event_id);
  const s01Input = {
    event: canonicalEvent,
    known_product_ids: product?.product_id ? [product.product_id] : [],
    existing_events: existingEvents,
    current_time: receivedAt,
  };
  const s01Output = validateS01(s01Input);
  const persisted = await persistIntake(db, rawEvent, canonicalEvent, s01Input, s01Output, receivedAt);
  return { found: true, ...persisted };
}

export async function intakePendingEvents(env, options = {}) {
  const db = env.CORE_DB;
  if (!db) throw new Error('CORE_DB is not configured');
  const limit = Math.min(Math.max(Number(options.limit || 20), 1), 50);
  const source = String(options.source || 'derived_layer_v1');

  const result = await db.prepare(`
    SELECT e.event_id
    FROM events e
    LEFT JOIN a1_event_intake_runs i
      ON i.event_id = e.event_id AND i.validator_version = ?
    WHERE e.source = ?
      AND e.processing_disposition = 'AWAITING_A1'
      AND i.event_id IS NULL
    ORDER BY e.occurred_at ASC
    LIMIT ?
  `).bind(S01_VALIDATOR_VERSION, source, limit).all();

  const outcomes = [];
  for (const row of result?.results || []) {
    outcomes.push(await intakeEventById(env, row.event_id));
  }

  return {
    intakeVersion: A1_INTAKE_VERSION,
    validatorVersion: S01_VALIDATOR_VERSION,
    source,
    selected: Number(result?.results?.length || 0),
    processed: outcomes.length,
    readyForS02: outcomes.filter((x) => x.intakeStatus === 'READY_FOR_S02').length,
    needsInformation: outcomes.filter((x) => x.intakeStatus === 'NEEDS_INFORMATION').length,
    blocked: outcomes.filter((x) => x.intakeStatus === 'BLOCKED').length,
    outcomes,
  };
}
