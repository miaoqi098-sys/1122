import {
  normalizeProfessionalAgentEvent,
  normalizeProfessionalAgentResponse,
} from './r16-professional-agent-event-normalizer.js';

export const A4_ADVERTISING_RUNTIME_VERSION = 'A4-advertising-runtime-v1.0.0';

const ALLOWED_INPUT_MODES = new Set(['simulated', 'trusted_read_only']);
const ENTITY_TYPES = new Set(['campaign', 'ad_group', 'ad', 'target', 'search_term', 'product']);
const PRIVILEGE_KEYS = new Set([
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'stateTransitionAuthorized',
  'productionWriteAuthorized',
  'approvalGranted',
  'finalDecision',
  'task',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDateTime(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function failClosed(reasons) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A4_ADVERTISING_RUNTIME_VERSION,
    domainResponse: null,
    normalizedResponse: null,
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
    runtimeVersion: A4_ADVERTISING_RUNTIME_VERSION,
    domainResponse: null,
    normalizedResponse: null,
    domainEvent: null,
    normalizedEvent: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}

function validateScope(scope) {
  const reasons = [];
  if (!isObject(scope)) return ['invalid_scope'];
  if (scope.scope_type !== 'product') reasons.push('unsupported_scope_type');
  if (!nonEmptyString(scope.scope_id)) reasons.push('missing_scope_id');
  if (!nonEmptyString(scope.product_id)) reasons.push('missing_product_id');
  return reasons;
}

function validateWindow(window, label) {
  const reasons = [];
  if (!isObject(window)) return [`invalid_${label}_window`];
  if (!nonEmptyString(window.window_id)) reasons.push(`missing_${label}_window_id`);
  if (!validDateTime(window.start_at) || !validDateTime(window.end_at)) reasons.push(`invalid_${label}_window_time`);
  if (validDateTime(window.start_at) && validDateTime(window.end_at) && Date.parse(window.start_at) >= Date.parse(window.end_at)) {
    reasons.push(`invalid_${label}_window_order`);
  }
  if (!finiteNonNegative(window.clicks)) reasons.push(`invalid_${label}_clicks`);
  if (!finiteNonNegative(window.attributed_orders)) reasons.push(`invalid_${label}_attributed_orders`);
  if (!finiteNonNegative(window.spend)) reasons.push(`invalid_${label}_spend`);
  if (!Array.isArray(window.evidence_refs) || window.evidence_refs.length === 0 || window.evidence_refs.some((ref) => !nonEmptyString(ref))) {
    reasons.push(`invalid_${label}_evidence_refs`);
  }
  if (window.freshness !== 'fresh') reasons.push(`${label}_window_not_fresh`);
  return reasons;
}

function validateEntity(entity) {
  const reasons = [];
  if (!isObject(entity)) return ['invalid_advertising_entity'];
  if (!ENTITY_TYPES.has(entity.entity_type)) reasons.push('invalid_advertising_entity_type');
  if (!nonEmptyString(entity.entity_id)) reasons.push('missing_advertising_entity_id');
  return reasons;
}

/**
 * Agent-4 V1 read-only advertising diagnostic adapter.
 *
 * V1 intentionally supports one narrow, deterministic signal only: a confirmed
 * advertising conversion breakdown where the same advertising entity has a prior
 * baseline with attributed orders, the current comparable window has at least as
 * many clicks but zero attributed orders, and the upstream read-only collector has
 * explicitly marked the sample as sufficient. This avoids guessing statistical
 * thresholds. The adapter normalizes both the professional response and event via
 * R16 and never changes bids, budgets, targeting, status, or any production state.
 */
export function runAgent4AdvertisingSignal(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  const reasons = [];
  if (!ALLOWED_INPUT_MODES.has(input.input_mode)) reasons.push('invalid_input_mode');
  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) reasons.push(`privilege_injection_${key}`);
  }
  reasons.push(...validateScope(input.scope));
  reasons.push(...validateEntity(input.entity));
  reasons.push(...validateWindow(input.baseline_window, 'baseline'));
  reasons.push(...validateWindow(input.current_window, 'current'));
  if (reasons.length) return failClosed(reasons);

  const baseline = input.baseline_window;
  const current = input.current_window;
  if (Date.parse(baseline.end_at) > Date.parse(current.start_at)) {
    return failClosed(['advertising_window_lineage_overlap']);
  }
  if (input.sample_sufficient !== true) {
    return observe('needs_confirmation', ['sample_not_explicitly_sufficient']);
  }
  if (baseline.attributed_orders <= 0) {
    return observe('needs_recheck', ['baseline_has_no_attributed_orders']);
  }
  if (current.attributed_orders > 0) {
    return observe('no_confirmed_breakdown', ['current_window_still_has_attributed_orders']);
  }
  if (current.clicks < baseline.clicks) {
    return observe('needs_recheck', ['click_volume_declined_so_conversion_breakdown_not_isolated']);
  }

  const evidenceRefs = [...new Set([...baseline.evidence_refs, ...current.evidence_refs])];
  if (!evidenceRefs.length) return failClosed(['missing_event_evidence']);

  const entity = input.entity;
  const requestId = nonEmptyString(input.request_id)
    ? input.request_id
    : `A4-REQ:${entity.entity_type}:${entity.entity_id}:${current.window_id}`;
  const generatedAt = options.generatedAt ?? current.end_at;
  if (!validDateTime(generatedAt)) return failClosed(['invalid_generated_at']);

  const diagnosisText = `Advertising conversion breakdown confirmed for ${entity.entity_type} ${entity.entity_id}: attributed orders fell from ${baseline.attributed_orders} to 0 while clicks were maintained or increased (${baseline.clicks} -> ${current.clicks}).`;
  const responseFacts = [
    `Baseline window ${baseline.window_id}: ${baseline.clicks} clicks, ${baseline.attributed_orders} attributed orders, spend ${baseline.spend}.`,
    `Current window ${current.window_id}: ${current.clicks} clicks, 0 attributed orders, spend ${current.spend}.`,
    'Upstream collector marked the comparison sample as sufficient.',
  ];

  const domainResponse = {
    request_id: requestId,
    responder_agent: 'Agent-4',
    status: 'completed',
    scope: { ...input.scope },
    facts: responseFacts.map((fact) => ({ fact })),
    diagnoses: [{ diagnosis: diagnosisText, confidence: 'high', evidence_refs: evidenceRefs }],
    recommendation_candidates: [{
      candidate: 'Inspect search-term/target relevance and listing conversion context before any bid, budget, targeting, or status change.',
      action_authorized: false,
    }],
    evidence_refs: evidenceRefs,
    data_quality: { sample_sufficient: true, freshness: 'fresh' },
    missing_inputs: [],
    limitations: ['Agent-4 diagnosis does not authorize advertising changes or final business decisions.'],
    cross_agent_dependencies: [
      { agent: 'Agent-9', reason: 'Check listing-level conversion context before attributing cause solely to advertising.' },
    ],
    generated_at: generatedAt,
  };

  const normalizedResponse = normalizeProfessionalAgentResponse({
    source_agent: 'Agent-4',
    request_id: requestId,
    status: domainResponse.status,
    analysis_scope: domainResponse.scope,
    facts: responseFacts,
    interpretation: [diagnosisText],
    conclusion: 'A material advertising conversion breakdown is confirmed for the observed entity and windows; cause remains unassigned.',
    recommendation: 'Request further relevance/listing context before any advertising mutation.',
    confidence: 'high',
    data_window: `${baseline.start_at}/${current.end_at}`,
    evidence_refs: evidenceRefs,
    missing_data: [],
    risks: domainResponse.limitations,
    generated_at: generatedAt,
    cross_agent_dependencies: domainResponse.cross_agent_dependencies,
  });
  if (normalizedResponse.status !== 'normalized') {
    return failClosed(['r16_response_normalization_failed', ...(normalizedResponse.reasons ?? [])]);
  }

  const domainEventId = `A4:${entity.entity_type}:${entity.entity_id}:${baseline.window_id}:${current.window_id}:advertising_conversion_breakdown`;
  const domainEvent = {
    event_id: domainEventId,
    source_agent: 'Agent-4',
    event_type: 'advertising_conversion_breakdown',
    scope: { ...input.scope },
    affected_entities: [{ entity_type: entity.entity_type, entity_id: entity.entity_id }],
    severity: 'high',
    confidence: 'high',
    status: 'confirmed',
    current_window: { ...current },
    baseline_window: { ...baseline },
    observed_at: current.end_at,
    generated_at: generatedAt,
    data_window: `${baseline.start_at}/${current.end_at}`,
    summary: diagnosisText,
    facts: responseFacts,
    evidence_refs: evidenceRefs,
    metric_deltas: [
      { metric: 'clicks', baseline: baseline.clicks, current: current.clicks, delta: current.clicks - baseline.clicks },
      { metric: 'attributed_orders', baseline: baseline.attributed_orders, current: 0, delta: -baseline.attributed_orders },
      { metric: 'spend', baseline: baseline.spend, current: current.spend, delta: Number((current.spend - baseline.spend).toFixed(4)) },
    ],
    metrics: {
      entity_type: entity.entity_type,
      entity_id: entity.entity_id,
      marketplace: input.scope.marketplace ?? null,
      baseline_window_id: baseline.window_id,
      current_window_id: current.window_id,
      baseline_clicks: baseline.clicks,
      current_clicks: current.clicks,
      baseline_attributed_orders: baseline.attributed_orders,
      current_attributed_orders: 0,
      baseline_spend: baseline.spend,
      current_spend: current.spend,
    },
    diagnosis: { diagnosis: diagnosisText, possible_causes: [], excluded_causes: [] },
    recommendation: 'Inspect search-term/target relevance and Agent-9 listing conversion context before any advertising change; no action is authorized.',
    recommendation_candidates: domainResponse.recommendation_candidates,
    cross_agent_requests: domainResponse.cross_agent_dependencies,
  };

  const normalizedEvent = normalizeProfessionalAgentEvent({
    source_agent: 'Agent-4',
    domain_schema: 'AdvertisingIntelligenceEvent.v1',
    domain_event_id: domainEventId,
    domain_event: domainEvent,
  }, {
    receivedAt: options.receivedAt ?? current.end_at,
    mappedAt: options.mappedAt ?? current.end_at,
  });
  if (normalizedEvent.status !== 'normalized') {
    return failClosed(['r16_event_normalization_failed', ...(normalizedEvent.reasons ?? [])]);
  }

  return {
    status: 'event_and_response_ready',
    nextAction: 'stop_before_A1_intake',
    reasons: [],
    runtimeVersion: A4_ADVERTISING_RUNTIME_VERSION,
    domainResponse,
    normalizedResponse,
    domainEvent,
    normalizedEvent,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
