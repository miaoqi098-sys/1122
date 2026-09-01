import {
  runS03,
  S03_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S03_冲突检测/执行程序/runtime.js';

export const A1_CONFLICT_DETECTOR_VERSION = 'a1-conflict-detector-v1.0.0';

const READY_S02 = new Set(['ready', 'ready_with_gaps']);

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function first(result) {
  return rows(result)[0] || null;
}

function scopeFromNormalizedEvent(event = {}, row = {}) {
  return {
    scope_type: event.scope_type || (row.product_id ? 'product' : 'global'),
    scope_id: event.scope_id ?? row.product_id ?? null,
    product_id: event.product_id ?? row.product_id ?? null,
    asin: event.asin ?? null,
  };
}

function normalizeStoredOutput(row) {
  if (!row) return null;
  return {
    conflictRunId: row.conflict_run_id,
    contextRunId: row.context_run_id,
    intakeId: row.intake_id,
    eventId: row.event_id,
    productId: row.product_id,
    marketplace: row.marketplace,
    s02Status: row.s02_status,
    s03Status: row.s03_status,
    nextAction: row.next_action,
    runtimeVersion: row.runtime_version,
    output: parseJson(row.s03_output_json, null),
    idempotent: true,
  };
}

async function getContextRun(env, contextRunId) {
  return env.CORE_DB.prepare(`
    SELECT
      c.context_run_id, c.intake_id, c.event_id, c.product_id, c.marketplace,
      c.context_package_json, c.context_refs_json, c.s02_status, c.next_action AS s02_next_action,
      c.loaded_at, i.normalized_event_json, i.s01_status
    FROM a1_context_runs c
    JOIN a1_event_intake_runs i ON i.intake_id = c.intake_id
    WHERE c.context_run_id = ?
    LIMIT 1
  `).bind(contextRunId).first();
}

async function getStoredRun(env, contextRunId) {
  return env.CORE_DB.prepare(`
    SELECT * FROM a1_conflict_runs
    WHERE context_run_id = ? AND runtime_version = ?
    LIMIT 1
  `).bind(contextRunId, S03_RUNTIME_VERSION).first();
}

function buildInput(row, options = {}) {
  const normalizedEvent = parseJson(row.normalized_event_json, {}) || {};
  const contextPackage = parseJson(row.context_package_json, {}) || {};
  const contextRefs = parseJson(row.context_refs_json, []) || [];
  return {
    event_id: row.event_id,
    scope: scopeFromNormalizedEvent(normalizedEvent, row),
    context_package: contextPackage,
    context_refs: contextRefs,
    normalized_elements: Array.isArray(options.normalizedElements) ? options.normalizedElements : undefined,
    current_time: options.currentTime,
  };
}

async function persistRun(env, row, input, output) {
  const conflictRunId = crypto.randomUUID();
  const generatedAt = output.generated_at || new Date().toISOString();
  const statements = [
    env.CORE_DB.prepare(`
      INSERT INTO a1_conflict_runs (
        conflict_run_id, context_run_id, intake_id, event_id, product_id, marketplace,
        s02_status, s03_input_json, normalized_elements_json, conflicts_json,
        conflict_groups_json, unresolved_points_json, s03_output_json,
        s03_status, next_action, runtime_version, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(context_run_id, runtime_version) DO NOTHING
    `).bind(
      conflictRunId,
      row.context_run_id,
      row.intake_id,
      row.event_id,
      row.product_id || null,
      row.marketplace || null,
      row.s02_status,
      JSON.stringify(input),
      JSON.stringify(output.normalized_elements || []),
      JSON.stringify(output.conflicts || []),
      JSON.stringify(output.conflict_groups || []),
      JSON.stringify(output.unresolved_points || []),
      JSON.stringify(output),
      output.status,
      output.next_action,
      S03_RUNTIME_VERSION,
      generatedAt,
    ),
    env.CORE_DB.prepare(`
      UPDATE data_source_state
      SET status = 'READY',
          last_success_at = ?,
          last_attempt_at = ?,
          freshness_status = 'FRESH',
          parser_version = ?,
          details_json = ?,
          updated_at = datetime('now')
      WHERE source_key = 'a1_conflict_detector'
    `).bind(
      generatedAt,
      generatedAt,
      S03_RUNTIME_VERSION,
      JSON.stringify({
        detector_version: A1_CONFLICT_DETECTOR_VERSION,
        last_context_run_id: row.context_run_id,
        last_event_id: row.event_id,
        s03_status: output.status,
        next_action: output.next_action,
        conflict_count: output.conflicts?.length || 0,
        context_package_is_unique_fact_source: true,
        direct_to_s04: false,
      }),
    ),
  ];
  await env.CORE_DB.batch(statements);
  const stored = await getStoredRun(env, row.context_run_id);
  return normalizeStoredOutput(stored);
}

export async function detectConflictsForContextRun(env, contextRunId, options = {}) {
  if (!env.CORE_DB) throw new Error('CORE_DB is not configured');
  const id = String(contextRunId || '').trim();
  if (!id) throw new Error('context_run_id is required');

  const existing = await getStoredRun(env, id);
  if (existing) return { found: true, ...normalizeStoredOutput(existing) };

  const row = await getContextRun(env, id);
  if (!row) return { found: false, contextRunId: id };
  if (!READY_S02.has(String(row.s02_status))) {
    return {
      found: true,
      contextRunId: id,
      eventId: row.event_id,
      eligible: false,
      s02Status: row.s02_status,
      message: 'Only ready / ready_with_gaps S02 ContextPackage can enter S03.',
    };
  }

  const input = buildInput(row, options);
  const output = runS03(input);
  const stored = await persistRun(env, row, input, output);
  return { found: true, eligible: true, ...stored };
}

export async function detectConflictsForEvent(env, eventId, options = {}) {
  if (!env.CORE_DB) throw new Error('CORE_DB is not configured');
  const id = String(eventId || '').trim();
  if (!id) throw new Error('event_id is required');
  const row = await env.CORE_DB.prepare(`
    SELECT c.context_run_id
    FROM a1_context_runs c
    WHERE c.event_id = ? AND c.s02_status IN ('ready', 'ready_with_gaps')
    ORDER BY c.loaded_at DESC
    LIMIT 1
  `).bind(id).first();
  if (!row?.context_run_id) return { found: false, eventId: id };
  return detectConflictsForContextRun(env, row.context_run_id, options);
}

export async function detectPendingConflicts(env, options = {}) {
  if (!env.CORE_DB) throw new Error('CORE_DB is not configured');
  const limit = Math.min(Math.max(Number(options.limit || 10), 1), 20);
  const result = await env.CORE_DB.prepare(`
    SELECT c.context_run_id
    FROM a1_context_runs c
    WHERE c.s02_status IN ('ready', 'ready_with_gaps')
      AND NOT EXISTS (
        SELECT 1 FROM a1_conflict_runs r
        WHERE r.context_run_id = c.context_run_id
          AND r.runtime_version = ?
      )
    ORDER BY c.loaded_at ASC
    LIMIT ?
  `).bind(S03_RUNTIME_VERSION, limit).all();

  const selected = rows(result);
  const outcomes = [];
  for (const row of selected) {
    outcomes.push(await detectConflictsForContextRun(env, row.context_run_id));
  }
  return {
    detectorVersion: A1_CONFLICT_DETECTOR_VERSION,
    runtimeVersion: S03_RUNTIME_VERSION,
    selected: selected.length,
    processed: outcomes.filter((o) => o.eligible !== false && o.found).length,
    clear: outcomes.filter((o) => o.s03Status === 'clear').length,
    conflictsFound: outcomes.filter((o) => o.s03Status === 'conflicts_found').length,
    needsEvidence: outcomes.filter((o) => o.s03Status === 'needs_evidence').length,
    blocked: outcomes.filter((o) => o.s03Status === 'blocked').length,
    outcomes,
  };
}
