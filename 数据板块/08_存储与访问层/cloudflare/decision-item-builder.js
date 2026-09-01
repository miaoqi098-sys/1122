import {
  runDecisionItemBuilder,
  DECISION_ITEM_BUILDER_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/统一接口/执行程序/decision-item-builder.runtime.js';

export const A1_DECISION_ITEM_BUILDER_VERSION = 'a1-decision-item-builder-v1.0.0';

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

function scopeFromEvent(event = {}, row = {}) {
  return {
    scope_type: event.scope_type || (row.product_id ? 'product' : 'global'),
    scope_id: event.scope_id ?? row.product_id ?? null,
    product_id: event.product_id ?? row.product_id ?? null,
    asin: event.asin ?? null,
  };
}

function normalizeStored(row) {
  if (!row) return null;
  return {
    builderRunId: row.builder_run_id,
    conflictRunId: row.conflict_run_id,
    contextRunId: row.context_run_id,
    intakeId: row.intake_id,
    eventId: row.event_id,
    productId: row.product_id,
    marketplace: row.marketplace,
    nextAction: row.next_action,
    runtimeVersion: row.runtime_version,
    output: parseJson(row.builder_output_json, null),
    idempotent: true,
  };
}

async function getConflictRun(env, conflictRunId) {
  return env.CORE_DB.prepare(`
    SELECT
      r.conflict_run_id, r.context_run_id, r.intake_id, r.event_id, r.product_id, r.marketplace,
      r.s03_status, r.next_action AS s03_next_action, r.conflicts_json, r.conflict_groups_json,
      r.s03_output_json, r.generated_at AS s03_generated_at,
      c.context_package_json, c.context_refs_json, c.s02_status,
      i.normalized_event_json
    FROM a1_conflict_runs r
    JOIN a1_context_runs c ON c.context_run_id = r.context_run_id
    JOIN a1_event_intake_runs i ON i.intake_id = r.intake_id
    WHERE r.conflict_run_id = ?
    LIMIT 1
  `).bind(conflictRunId).first();
}

async function getStoredRun(env, conflictRunId) {
  return env.CORE_DB.prepare(`
    SELECT * FROM a1_decision_item_builder_runs
    WHERE conflict_run_id=? AND runtime_version=?
    LIMIT 1
  `).bind(conflictRunId, DECISION_ITEM_BUILDER_RUNTIME_VERSION).first();
}

function buildInput(row, options = {}) {
  const event = parseJson(row.normalized_event_json, {}) || {};
  const contextPackage = parseJson(row.context_package_json, {}) || {};
  const contextRefs = parseJson(row.context_refs_json, []) || [];
  const conflicts = parseJson(row.conflicts_json, []) || [];
  const conflictGroups = parseJson(row.conflict_groups_json, []) || [];
  return {
    scope: scopeFromEvent(event, row),
    source_event_refs: [row.event_id],
    context_package: contextPackage,
    context_refs: contextRefs,
    conflicts,
    conflict_groups: conflictGroups,
    builder_policy: options.builderPolicy || undefined,
    s03_status: row.s03_status,
    s03_next_action: row.s03_next_action,
    event_type: event.event_type || null,
    severity: event.severity || null,
    current_time: options.currentTime,
  };
}

async function persistRun(env, row, input, output) {
  const builderRunId = crypto.randomUUID();
  const generatedAt = output.generated_at || new Date().toISOString();
  const statements = [
    env.CORE_DB.prepare(`
      INSERT INTO a1_decision_item_builder_runs (
        builder_run_id, conflict_run_id, context_run_id, intake_id, event_id, product_id, marketplace,
        builder_input_json, decision_items_json, merged_source_groups_json, builder_notes_json,
        builder_output_json, next_action, runtime_version, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(conflict_run_id, runtime_version) DO NOTHING
    `).bind(
      builderRunId, row.conflict_run_id, row.context_run_id, row.intake_id, row.event_id,
      row.product_id || null, row.marketplace || null,
      JSON.stringify(input), JSON.stringify(output.decision_items || []),
      JSON.stringify(output.merged_source_groups || []), JSON.stringify(output.builder_notes || []),
      JSON.stringify(output), output.next_action, DECISION_ITEM_BUILDER_RUNTIME_VERSION, generatedAt,
    ),
  ];

  if (output.next_action === 'continue_to_S04') {
    for (const item of output.decision_items || []) {
      statements.push(env.CORE_DB.prepare(`
        INSERT INTO a1_decision_items (
          decision_item_id, builder_run_id, event_id, product_id, marketplace,
          item_type, subject, problem_definition, objective, goal_layer,
          severity, urgency, decision_item_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(decision_item_id) DO NOTHING
      `).bind(
        item.decision_item_id, builderRunId, row.event_id, row.product_id || null, row.marketplace || null,
        item.item_type, item.subject, item.problem_definition, item.objective, item.goal_layer,
        item.severity || null, item.urgency || null, JSON.stringify(item), item.created_at || generatedAt,
      ));
    }
  }

  statements.push(env.CORE_DB.prepare(`
    UPDATE data_source_state
    SET status=?, last_success_at=?, last_attempt_at=?, freshness_status=?, parser_version=?, details_json=?, updated_at=datetime('now')
    WHERE source_key='a1_decision_item_builder'
  `).bind(
    output.next_action === 'continue_to_S04' ? 'READY' : 'ATTENTION',
    output.next_action === 'continue_to_S04' ? generatedAt : null,
    generatedAt,
    output.next_action === 'continue_to_S04' ? 'FRESH' : 'REVIEW',
    DECISION_ITEM_BUILDER_RUNTIME_VERSION,
    JSON.stringify({
      builder_version: A1_DECISION_ITEM_BUILDER_VERSION,
      last_conflict_run_id: row.conflict_run_id,
      last_event_id: row.event_id,
      next_action: output.next_action,
      decision_item_count: output.decision_items?.length || 0,
      context_package_is_unique_fact_source: true,
      builder_does_not_rank: true,
    }),
  ));

  await env.CORE_DB.batch(statements);
  return normalizeStored(await getStoredRun(env, row.conflict_run_id));
}

export async function buildDecisionItemsForConflictRun(env, conflictRunId, options = {}) {
  if (!env.CORE_DB) throw new Error('CORE_DB is not configured');
  const id = String(conflictRunId || '').trim();
  if (!id) throw new Error('conflict_run_id is required');

  const existing = await getStoredRun(env, id);
  if (existing) return { found: true, eligible: true, ...normalizeStored(existing) };

  const row = await getConflictRun(env, id);
  if (!row) return { found: false, conflictRunId: id };
  if (row.s03_next_action !== 'continue_to_decision_item_builder') {
    return {
      found: true,
      eligible: false,
      conflictRunId: id,
      eventId: row.event_id,
      s03Status: row.s03_status,
      s03NextAction: row.s03_next_action,
      message: 'Only S03 continue_to_decision_item_builder can enter DecisionItemBuilder.',
    };
  }

  const input = buildInput(row, options);
  const output = runDecisionItemBuilder(input);
  const stored = await persistRun(env, row, input, output);
  return { found: true, eligible: true, ...stored };
}

export async function buildDecisionItemsForEvent(env, eventId, options = {}) {
  if (!env.CORE_DB) throw new Error('CORE_DB is not configured');
  const id = String(eventId || '').trim();
  if (!id) throw new Error('event_id is required');
  const row = await env.CORE_DB.prepare(`
    SELECT conflict_run_id
    FROM a1_conflict_runs
    WHERE event_id=? AND next_action='continue_to_decision_item_builder'
    ORDER BY generated_at DESC LIMIT 1
  `).bind(id).first();
  if (!row?.conflict_run_id) return { found: false, eventId: id };
  return buildDecisionItemsForConflictRun(env, row.conflict_run_id, options);
}

export async function buildPendingDecisionItems(env, options = {}) {
  if (!env.CORE_DB) throw new Error('CORE_DB is not configured');
  const limit = Math.min(Math.max(Number(options.limit || 10), 1), 20);
  const result = await env.CORE_DB.prepare(`
    SELECT r.conflict_run_id
    FROM a1_conflict_runs r
    WHERE r.next_action='continue_to_decision_item_builder'
      AND NOT EXISTS (
        SELECT 1 FROM a1_decision_item_builder_runs b
        WHERE b.conflict_run_id=r.conflict_run_id AND b.runtime_version=?
      )
    ORDER BY r.generated_at ASC
    LIMIT ?
  `).bind(DECISION_ITEM_BUILDER_RUNTIME_VERSION, limit).all();

  const selected = rows(result);
  const outcomes = [];
  for (const row of selected) outcomes.push(await buildDecisionItemsForConflictRun(env, row.conflict_run_id, options));
  return {
    builderVersion: A1_DECISION_ITEM_BUILDER_VERSION,
    runtimeVersion: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
    selected: selected.length,
    processed: outcomes.filter((o) => o.found && o.eligible !== false).length,
    readyForS04: outcomes.filter((o) => o.output?.next_action === 'continue_to_S04').length,
    needsMoreContext: outcomes.filter((o) => o.output?.next_action === 'request_more_context').length,
    held: outcomes.filter((o) => o.output?.next_action === 'hold_for_review').length,
    outcomes,
  };
}

// deploy trigger: decision-item-builder-v1.0
