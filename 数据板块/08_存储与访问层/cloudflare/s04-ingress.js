export const S04_INGRESS_CONTRACT_VERSION = 'S04-ingress-contract-v1.2.0';

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

  if (!item || typeof item !== 'object') {
    reasons.push('invalid_decision_item_json');
  } else {
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
