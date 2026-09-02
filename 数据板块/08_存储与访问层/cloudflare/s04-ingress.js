export const S04_INGRESS_CONTRACT_VERSION = 'S04-ingress-contract-v1.6.0';

function parseJson(value, fallback = null) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function eventIdFromRef(ref) {
  const value = String(ref || '').trim();
  if (!value) return '';
  if (value.startsWith('d1:events:')) return value.slice('d1:events:'.length).split(':')[0];
  return value;
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

const S04_ITEM_TYPES = new Set(['risk', 'opportunity', 'goal_gap', 'problem', 'investigation']);
const S04_GOAL_LAYERS = new Set([
  'safety_sellability',
  'survival_operations',
  'growth_expansion',
  'business_quality',
  'unknown',
]);
const S04_URGENCIES = new Set(['immediate', 'high', 'medium', 'low', 'unknown']);
const S04_EVIDENCE_STRENGTHS = new Set(['high', 'medium', 'low', 'unknown']);
const S04_SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);

function validateDecisionItemShape(item, reasons) {
  const requiredTextFields = [
    'decision_item_id',
    'item_type',
    'subject',
    'problem_definition',
    'objective',
    'goal_layer',
    'urgency',
    'evidence_strength',
  ];
  for (const field of requiredTextFields) {
    if (!text(item?.[field])) reasons.push(`missing_decision_item_${field}`);
  }

  const itemType = text(item?.item_type);
  if (itemType && !S04_ITEM_TYPES.has(itemType)) reasons.push('unsupported_decision_item_type');

  const goalLayer = text(item?.goal_layer);
  if (goalLayer && !S04_GOAL_LAYERS.has(goalLayer)) reasons.push('unsupported_decision_item_goal_layer');

  const urgency = text(item?.urgency);
  if (urgency && !S04_URGENCIES.has(urgency)) reasons.push('unsupported_decision_item_urgency');

  const evidenceStrength = text(item?.evidence_strength);
  if (evidenceStrength && !S04_EVIDENCE_STRENGTHS.has(evidenceStrength)) {
    reasons.push('unsupported_decision_item_evidence_strength');
  }

  const severity = text(item?.severity);
  if (severity && !S04_SEVERITIES.has(severity.toUpperCase())) {
    reasons.push('unsupported_decision_item_severity');
  }

  if (!Array.isArray(item?.source_event_refs) || item.source_event_refs.length === 0) {
    reasons.push('missing_decision_item_source_event_refs');
  }

  if (!text(item?.created_at) || !Number.isFinite(Date.parse(item.created_at))) {
    reasons.push('invalid_decision_item_created_at');
  }

  if (item?.dependency_count !== undefined && item?.dependency_count !== null) {
    const count = Number(item.dependency_count);
    if (!Number.isInteger(count) || count < 0) reasons.push('invalid_decision_item_dependency_count');
  }

  for (const field of ['blocked_items', 'conflict_refs', 'constraint_refs', 'evidence_refs', 'context_refs']) {
    if (item?.[field] !== undefined && !Array.isArray(item[field])) {
      reasons.push(`invalid_decision_item_${field}`);
    }
  }
}

export function validateS04DecisionItemLineage(row = {}) {
  const reasons = [];
  const item = parseJson(row.decision_item_json, null);

  if (!row.decision_item_id) reasons.push('missing_decision_item_id');
  if (!row.builder_run_id) reasons.push('missing_builder_run_id');
  if (!row.conflict_run_id) reasons.push('missing_conflict_run_id');
  if (!row.event_id) reasons.push('missing_event_id');
  if (!row.builder_context_run_id) reasons.push('missing_builder_context_run_id');
  if (!row.conflict_context_run_id) reasons.push('missing_conflict_context_run_id');
  if (!row.builder_intake_id) reasons.push('missing_builder_intake_id');
  if (!row.conflict_intake_id) reasons.push('missing_conflict_intake_id');

  if (row.builder_next_action !== 'continue_to_S04') {
    reasons.push('builder_not_released_to_S04');
  }
  if (row.s03_next_action !== 'continue_to_decision_item_builder') {
    reasons.push('s03_not_released_to_builder');
  }

  if (row.builder_event_id !== row.event_id) reasons.push('builder_event_mismatch');
  if (row.conflict_event_id !== row.event_id) reasons.push('conflict_event_mismatch');
  if (row.builder_conflict_run_id !== row.conflict_run_id) reasons.push('builder_conflict_mismatch');
  if (row.builder_context_run_id !== row.conflict_context_run_id) reasons.push('context_run_mismatch');
  if (row.builder_intake_id !== row.conflict_intake_id) reasons.push('intake_mismatch');

  if (
    row.decision_product_id !== row.builder_product_id ||
    row.builder_product_id !== row.conflict_product_id
  ) {
    reasons.push('product_lineage_mismatch');
  }
  if (
    row.decision_marketplace !== row.builder_marketplace ||
    row.builder_marketplace !== row.conflict_marketplace
  ) {
    reasons.push('marketplace_lineage_mismatch');
  }

  // Builder input is mandatory provenance. Never let a partial row skip scope checks:
  // callers of this exported validator must prove the same persisted product/store/global
  // scope that the D1 ingress query provides.
  const builderInput = parseJson(row.builder_input_json, null);
  if (!builderInput || typeof builderInput !== 'object') {
    reasons.push('invalid_builder_input_json');
  } else {
    const scope = builderInput.scope;
    const scopeType = text(scope?.scope_type);
    const scopeId = text(scope?.scope_id);
    const scopeProductId = text(scope?.product_id);
    const productId = text(row.builder_product_id);
    const marketplace = text(row.builder_marketplace);

    if (!scope || typeof scope !== 'object' || !scopeType || !scopeId) {
      reasons.push('missing_builder_scope');
    } else if (scopeType === 'product') {
      if (!scopeProductId || !productId) reasons.push('incomplete_product_scope_lineage');
      if (scopeId !== scopeProductId || scopeProductId !== productId) reasons.push('product_scope_mismatch');
    } else if (scopeType === 'store') {
      if (scopeProductId || productId) reasons.push('store_scope_product_mismatch');
      if (!marketplace || scopeId !== marketplace) reasons.push('store_scope_mismatch');
    } else if (scopeType === 'global') {
      if (scopeProductId || productId || marketplace) reasons.push('global_scope_lineage_mismatch');
    } else {
      reasons.push('unsupported_scope_type');
    }
  }

  if (!item || typeof item !== 'object') {
    reasons.push('invalid_decision_item_json');
  } else {
    validateDecisionItemShape(item, reasons);
    if (item.decision_item_id !== row.decision_item_id) reasons.push('decision_item_id_mismatch');
    const refs = Array.isArray(item.source_event_refs) ? item.source_event_refs : [];
    const refEventIds = refs.map(eventIdFromRef).filter(Boolean);
    const expectedEventId = String(row.event_id || '');
    if (!refEventIds.includes(expectedEventId)) reasons.push('source_event_ref_mismatch');
    if (refEventIds.some((eventId) => eventId !== expectedEventId)) reasons.push('cross_event_source_ref');
  }

  return {
    eligible: reasons.length === 0,
    nextAction: reasons.length === 0 ? 'continue_to_S04' : 'hold_for_review',
    reasons,
    decisionItem: item,
    contractVersion: S04_INGRESS_CONTRACT_VERSION,
  };
}

export async function getS04ReadyDecisionItem(env, decisionItemId) {
  if (!env?.CORE_DB) throw new Error('CORE_DB is not configured');
  const id = String(decisionItemId || '').trim();
  if (!id) throw new Error('decision_item_id is required');

  const row = await env.CORE_DB.prepare(`
    SELECT
      d.decision_item_id,
      d.builder_run_id,
      d.event_id,
      d.product_id AS decision_product_id,
      d.marketplace AS decision_marketplace,
      d.decision_item_json,
      b.conflict_run_id,
      b.conflict_run_id AS builder_conflict_run_id,
      b.event_id AS builder_event_id,
      b.context_run_id AS builder_context_run_id,
      b.intake_id AS builder_intake_id,
      b.product_id AS builder_product_id,
      b.marketplace AS builder_marketplace,
      b.builder_input_json,
      b.next_action AS builder_next_action,
      r.event_id AS conflict_event_id,
      r.context_run_id AS conflict_context_run_id,
      r.intake_id AS conflict_intake_id,
      r.product_id AS conflict_product_id,
      r.marketplace AS conflict_marketplace,
      r.next_action AS s03_next_action
    FROM a1_decision_items d
    JOIN a1_decision_item_builder_runs b ON b.builder_run_id = d.builder_run_id
    JOIN a1_conflict_runs r ON r.conflict_run_id = b.conflict_run_id
    WHERE d.decision_item_id = ?
    LIMIT 1
  `).bind(id).first();

  if (!row) {
    return {
      found: false,
      eligible: false,
      nextAction: 'hold_for_review',
      decisionItemId: id,
      reasons: ['missing_persisted_lineage'],
      contractVersion: S04_INGRESS_CONTRACT_VERSION,
    };
  }

  const validation = validateS04DecisionItemLineage(row);
  return {
    found: true,
    decisionItemId: id,
    builderRunId: row.builder_run_id,
    conflictRunId: row.conflict_run_id,
    eventId: row.event_id,
    ...validation,
  };
}
