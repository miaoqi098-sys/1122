import { normalizeProfessionalAgentEvent } from './r16-professional-agent-event-normalizer.js';

export const A3_COMPETITOR_PRICE_RUNTIME_VERSION = 'A3-competitor-price-runtime-v1.0.0';

const ALLOWED_INPUT_MODES = new Set(['simulated', 'trusted_read_only']);
const ENTITY_TYPES = new Set(['asin', 'parent_product', 'brand']);
const PRIVILEGE_KEYS = new Set([
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'stateTransitionAuthorized',
  'productionWriteAuthorized',
  'finalDecision',
  'task',
]);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDateTime(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A3_COMPETITOR_PRICE_RUNTIME_VERSION,
    domainEvent: null,
    normalizedEvent: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}

function observe(status, reasons = []) {
  return {
    status,
    nextAction: 'observe',
    reasons: [...new Set(reasons)],
    runtimeVersion: A3_COMPETITOR_PRICE_RUNTIME_VERSION,
    domainEvent: null,
    normalizedEvent: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}

function validateSnapshot(snapshot, label) {
  const reasons = [];
  if (!isObject(snapshot)) return [`invalid_${label}_snapshot`];
  if (!nonEmptyString(snapshot.snapshot_id)) reasons.push(`missing_${label}_snapshot_id`);
  if (!nonEmptyString(snapshot.competitor_entity_id)) reasons.push(`missing_${label}_competitor_entity_id`);
  if (!ENTITY_TYPES.has(snapshot.entity_type)) reasons.push(`invalid_${label}_entity_type`);
  if (!nonEmptyString(snapshot.entity_ref)) reasons.push(`missing_${label}_entity_ref`);
  if (!nonEmptyString(snapshot.marketplace)) reasons.push(`missing_${label}_marketplace`);
  if (!validDateTime(snapshot.observed_at)) reasons.push(`invalid_${label}_observed_at`);
  if (!Array.isArray(snapshot.source_refs) || snapshot.source_refs.length === 0 || snapshot.source_refs.some((x) => !nonEmptyString(x))) {
    reasons.push(`invalid_${label}_source_refs`);
  }
  if (!isObject(snapshot.facts)) reasons.push(`invalid_${label}_facts`);
  if (snapshot.comparison_eligible !== true) reasons.push(`${label}_snapshot_not_comparison_eligible`);
  if (Array.isArray(snapshot.comparison_blockers) && snapshot.comparison_blockers.length > 0) {
    reasons.push(`${label}_snapshot_has_comparison_blockers`);
  }
  if (typeof snapshot.confidence !== 'number' || !Number.isFinite(snapshot.confidence) || snapshot.confidence < 0 || snapshot.confidence > 1) {
    reasons.push(`invalid_${label}_confidence`);
  }
  if (snapshot.freshness === 'stale' || snapshot.freshness === 'unknown') reasons.push(`${label}_snapshot_not_fresh_enough`);
  return reasons;
}

function snapshotIdentity(snapshot) {
  return [snapshot.competitor_entity_id, snapshot.entity_type, snapshot.entity_ref, snapshot.marketplace].join('|');
}

function priceFact(snapshot) {
  const price = snapshot?.facts?.current_price;
  const currency = snapshot?.facts?.currency;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  if (!nonEmptyString(currency)) return null;
  return { price, currency: currency.trim().toUpperCase() };
}

function validateOurScope(scope) {
  if (!isObject(scope)) return ['invalid_our_scope'];
  const reasons = [];
  if (scope.scope_type !== 'product') reasons.push('unsupported_our_scope_type');
  if (!nonEmptyString(scope.product_id)) reasons.push('missing_our_product_id');
  if (!nonEmptyString(scope.scope_id)) reasons.push('missing_our_scope_id');
  return reasons;
}

function scopeBound(snapshot, scope) {
  if (!Array.isArray(snapshot.our_scope_refs) || snapshot.our_scope_refs.length === 0) return false;
  return snapshot.our_scope_refs.includes(scope.product_id) || snapshot.our_scope_refs.includes(scope.scope_id);
}

/**
 * Agent-3 V1 read-only competitor price signal adapter.
 *
 * It deliberately requires three comparable snapshots: one baseline plus two
 * consecutive observations of the same lower price. A single observation,
 * low-confidence evidence, non-comparable data, or uncertain relationship never
 * becomes a deterministic business event. The adapter only emits a professional
 * Agent-3 event through R16; it cannot approve, dispatch, execute, or mutate data.
 */
export function runAgent3CompetitorPriceSignal(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  const reasons = [];
  if (!ALLOWED_INPUT_MODES.has(input.input_mode)) reasons.push('invalid_input_mode');
  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) reasons.push(`privilege_injection_${key}`);
  }
  reasons.push(...validateOurScope(input.our_scope));

  const baseline = input.baseline_snapshot;
  const changed = input.first_changed_snapshot;
  const current = input.current_snapshot;
  reasons.push(...validateSnapshot(baseline, 'baseline'));
  reasons.push(...validateSnapshot(changed, 'first_changed'));
  reasons.push(...validateSnapshot(current, 'current'));
  if (reasons.length) return failClosed(reasons);

  if (snapshotIdentity(baseline) !== snapshotIdentity(changed) || snapshotIdentity(changed) !== snapshotIdentity(current)) {
    return failClosed(['competitor_snapshot_identity_mismatch']);
  }
  if (!scopeBound(baseline, input.our_scope) || !scopeBound(changed, input.our_scope) || !scopeBound(current, input.our_scope)) {
    return failClosed(['competitor_snapshot_our_scope_mismatch']);
  }

  const baselineAt = Date.parse(baseline.observed_at);
  const changedAt = Date.parse(changed.observed_at);
  const currentAt = Date.parse(current.observed_at);
  if (!(baselineAt < changedAt && changedAt < currentAt)) {
    return failClosed(['competitor_snapshot_time_lineage_invalid']);
  }

  const relationshipTypes = Array.isArray(current.relationship_types) ? current.relationship_types : [];
  if (!relationshipTypes.includes('direct_competitor')) {
    return observe('needs_recheck', ['v1_price_signal_requires_direct_competitor_relation']);
  }

  const baselinePrice = priceFact(baseline);
  const changedPrice = priceFact(changed);
  const currentPrice = priceFact(current);
  if (!baselinePrice || !changedPrice || !currentPrice) {
    return failClosed(['missing_normalized_price_facts']);
  }
  if (baselinePrice.currency !== changedPrice.currency || changedPrice.currency !== currentPrice.currency) {
    return failClosed(['price_currency_mismatch']);
  }

  if (baselinePrice.price === changedPrice.price && changedPrice.price === currentPrice.price) {
    return observe('no_change');
  }
  if (changedPrice.price !== currentPrice.price) {
    return observe('needs_confirmation', ['price_change_not_confirmed_by_second_observation']);
  }
  if (changedPrice.price >= baselinePrice.price) {
    return observe('needs_recheck', ['v1_immediate_event_allowlist_only_supports_confirmed_price_decrease']);
  }

  const confidence = Math.min(baseline.confidence, changed.confidence, current.confidence);
  if (confidence < 0.8) {
    return observe('needs_confirmation', ['confirmed_price_change_confidence_below_v1_threshold']);
  }

  const evidenceRefs = [...new Set([
    ...baseline.source_refs,
    ...changed.source_refs,
    ...current.source_refs,
  ])];
  if (evidenceRefs.length === 0) return failClosed(['missing_event_evidence']);

  const decrease = baselinePrice.price - currentPrice.price;
  const decreasePct = Number(((decrease / baselinePrice.price) * 100).toFixed(2));
  const relationshipType = 'direct_competitor';
  const domainEventId = `A3:${current.competitor_entity_id}:${baseline.snapshot_id}:${current.snapshot_id}:competitor_price_shift`;

  const domainEvent = {
    event_id: domainEventId,
    event_type: 'competitor_price_shift',
    scope: {
      scope_type: 'product',
      scope_id: input.our_scope.scope_id,
      product_id: input.our_scope.product_id,
      asin: input.our_scope.asin ?? null,
    },
    scope_objects: [{
      entity_type: current.entity_type,
      entity_id: current.competitor_entity_id,
      entity_ref: current.entity_ref,
      relationship_type: relationshipType,
      marketplace: current.marketplace,
    }],
    severity: 'medium',
    observed_at: current.observed_at,
    data_window: `${baseline.observed_at}/${current.observed_at}`,
    summary: `Direct competitor ${current.entity_ref} confirmed a sustained price decrease from ${baselinePrice.currency} ${baselinePrice.price} to ${currentPrice.currency} ${currentPrice.price}.`,
    facts: [
      `Baseline price was ${baselinePrice.currency} ${baselinePrice.price} at ${baseline.observed_at}.`,
      `First changed observation was ${changedPrice.currency} ${changedPrice.price} at ${changed.observed_at}.`,
      `Second comparable observation confirmed ${currentPrice.currency} ${currentPrice.price} at ${current.observed_at}.`,
    ],
    metrics: {
      competitor_entity_id: current.competitor_entity_id,
      competitor_entity_ref: current.entity_ref,
      relationship_type: relationshipType,
      marketplace: current.marketplace,
      baseline_snapshot_id: baseline.snapshot_id,
      first_changed_snapshot_id: changed.snapshot_id,
      current_snapshot_id: current.snapshot_id,
      baseline_price: baselinePrice.price,
      current_price: currentPrice.price,
      currency: currentPrice.currency,
      decrease_amount: Number(decrease.toFixed(4)),
      decrease_percent: decreasePct,
    },
    confidence,
    evidence_refs: evidenceRefs,
    recommendation: 'Request Agent-10 assessment before any pricing or promotion response; this is not an approved action.',
    status: 'open',
  };

  const normalizedEvent = normalizeProfessionalAgentEvent({
    source_agent: 'Agent-3',
    domain_schema: 'Agent3CompetitorPriceSignal.v1',
    domain_event_id: domainEventId,
    domain_event: domainEvent,
  }, {
    receivedAt: options.receivedAt ?? current.observed_at,
    mappedAt: options.mappedAt ?? current.observed_at,
  });

  if (normalizedEvent.status !== 'normalized') {
    return failClosed(['r16_event_normalization_failed', ...(normalizedEvent.reasons ?? [])]);
  }

  return {
    status: 'event_ready',
    nextAction: 'continue_to_A1_event_intake',
    reasons: [],
    runtimeVersion: A3_COMPETITOR_PRICE_RUNTIME_VERSION,
    domainEvent,
    normalizedEvent,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
