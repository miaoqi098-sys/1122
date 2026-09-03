import { normalizeProfessionalAgentEvent } from './r16-professional-agent-event-normalizer.js';

export const A2_PRODUCT_STATUS_RUNTIME_VERSION = 'A2-product-status-runtime-v1.0.0';

const ALLOWED_INPUT_MODES = new Set(['simulated', 'trusted_read_only']);
const PRODUCT_SCOPES = new Set(['parent_product', 'product', 'sku']);
const HIGH_RISK_AVAILABILITY = new Set(['suppressed', 'restricted', 'unavailable']);
const PRIVILEGE_KEYS = new Set([
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'stateTransitionAuthorized',
]);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDateTime(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function failClosed(reasons) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A2_PRODUCT_STATUS_RUNTIME_VERSION,
    domainEvent: null,
    normalizedEvent: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}

function validateSnapshot(snapshot, label) {
  const reasons = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return [`invalid_${label}_snapshot`];
  }
  if (!nonEmptyString(snapshot.snapshot_id)) reasons.push(`missing_${label}_snapshot_id`);
  if (!nonEmptyString(snapshot.scope_type)) reasons.push(`missing_${label}_scope_type`);
  if (!nonEmptyString(snapshot.scope_id)) reasons.push(`missing_${label}_scope_id`);
  if (!validDateTime(snapshot.observed_at)) reasons.push(`invalid_${label}_observed_at`);
  if (!Array.isArray(snapshot.source_refs) || snapshot.source_refs.length === 0 || snapshot.source_refs.some((x) => !nonEmptyString(x))) {
    reasons.push(`invalid_${label}_source_refs`);
  }
  if (!snapshot.domains || typeof snapshot.domains !== 'object' || Array.isArray(snapshot.domains)) {
    reasons.push(`invalid_${label}_domains`);
  }
  if (!Array.isArray(snapshot.raw_facts)) reasons.push(`invalid_${label}_raw_facts`);
  if (!Array.isArray(snapshot.evidence_refs)) reasons.push(`invalid_${label}_evidence_refs`);
  if (!snapshot.freshness || typeof snapshot.freshness !== 'object' || !nonEmptyString(snapshot.freshness.status)) {
    reasons.push(`invalid_${label}_freshness`);
  }
  if (typeof snapshot.confidence !== 'number' || !Number.isFinite(snapshot.confidence) || snapshot.confidence < 0 || snapshot.confidence > 1) {
    reasons.push(`invalid_${label}_confidence`);
  }
  return reasons;
}

function productIdFrom(snapshot) {
  if (!PRODUCT_SCOPES.has(snapshot.scope_type)) return null;
  const metadata = snapshot.metadata && typeof snapshot.metadata === 'object' ? snapshot.metadata : {};
  return metadata.product_id ?? metadata.asin ?? snapshot.scope_id;
}

export function runAgent2ProductStatus(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return failClosed(['invalid_runtime_input']);
  }

  const reasons = [];
  if (!ALLOWED_INPUT_MODES.has(input.input_mode)) reasons.push('invalid_input_mode');
  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) reasons.push(`privilege_injection_${key}`);
  }

  const previous = input.previous_snapshot;
  const current = input.current_snapshot;
  reasons.push(...validateSnapshot(previous, 'previous'));
  reasons.push(...validateSnapshot(current, 'current'));
  if (reasons.length) return failClosed(reasons);

  if (previous.scope_type !== current.scope_type || previous.scope_id !== current.scope_id) {
    return failClosed(['snapshot_scope_mismatch']);
  }
  if (current.previous_snapshot_id !== undefined && current.previous_snapshot_id !== null && current.previous_snapshot_id !== previous.snapshot_id) {
    return failClosed(['snapshot_lineage_mismatch']);
  }
  if (current.freshness.status === 'stale' || current.freshness.status === 'unknown') {
    return failClosed(['current_snapshot_not_fresh_enough']);
  }
  if (Array.isArray(current.source_conflicts) && current.source_conflicts.length > 0) {
    return failClosed(['current_snapshot_source_conflict']);
  }
  if (Date.parse(current.observed_at) < Date.parse(previous.observed_at)) {
    return failClosed(['snapshot_time_regression']);
  }

  const previousAvailability = previous.domains.availability_state;
  const currentAvailability = current.domains.availability_state;

  if (previousAvailability === currentAvailability) {
    return {
      status: 'no_change',
      nextAction: 'observe',
      reasons: [],
      runtimeVersion: A2_PRODUCT_STATUS_RUNTIME_VERSION,
      domainEvent: null,
      normalizedEvent: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  if (previousAvailability !== 'active' || !HIGH_RISK_AVAILABILITY.has(currentAvailability)) {
    return {
      status: 'needs_recheck',
      nextAction: 'observe',
      reasons: ['change_not_in_v1_immediate_event_allowlist'],
      runtimeVersion: A2_PRODUCT_STATUS_RUNTIME_VERSION,
      domainEvent: null,
      normalizedEvent: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  const productId = productIdFrom(current);
  if (PRODUCT_SCOPES.has(current.scope_type) && !nonEmptyString(productId)) {
    return failClosed(['missing_product_id_for_product_scope']);
  }

  const eventType = `availability_${currentAvailability}`;
  const domainEventId = `A2:${current.snapshot_id}:availability_state`;
  const evidenceRefs = [...new Set([...(current.evidence_refs ?? []), ...(current.source_refs ?? [])])];
  if (evidenceRefs.length === 0) return failClosed(['missing_event_evidence']);

  const domainEvent = {
    event_id: domainEventId,
    event_type: eventType,
    scope: {
      scope_type: current.scope_type,
      scope_id: current.scope_id,
      product_id: productId,
      asin: current.metadata?.asin ?? null,
    },
    severity: 'high',
    observed_at: current.observed_at,
    summary: `${current.scope_id} availability changed from active to ${currentAvailability}.`,
    facts: [
      `Previous availability_state was active at ${previous.observed_at}.`,
      `Current availability_state is ${currentAvailability} at ${current.observed_at}.`,
    ],
    confidence: Math.min(previous.confidence, current.confidence),
    evidence_refs: evidenceRefs,
    recommendation: 'Request cause evidence before any production action.',
    status: 'open',
  };

  const normalizedEvent = normalizeProfessionalAgentEvent({
    source_agent: 'Agent-2',
    domain_schema: 'Agent2ProductStatusAvailabilityEvent.v1',
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
    runtimeVersion: A2_PRODUCT_STATUS_RUNTIME_VERSION,
    domainEvent,
    normalizedEvent,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
