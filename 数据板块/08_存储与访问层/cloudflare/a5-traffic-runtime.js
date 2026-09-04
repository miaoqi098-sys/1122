import {
  normalizeProfessionalAgentEvent,
  normalizeProfessionalAgentResponse,
} from './r16-professional-agent-event-normalizer.js';

export const A5_TRAFFIC_RUNTIME_VERSION = 'A5-traffic-runtime-v1.0.0';

const ALLOWED_INPUT_MODES = new Set(['simulated', 'trusted_read_only']);
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
    runtimeVersion: A5_TRAFFIC_RUNTIME_VERSION,
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
    runtimeVersion: A5_TRAFFIC_RUNTIME_VERSION,
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
  if (!finiteNonNegative(window.sessions)) reasons.push(`invalid_${label}_sessions`);
  if (!Array.isArray(window.evidence_refs) || window.evidence_refs.length === 0 || window.evidence_refs.some((ref) => !nonEmptyString(ref))) {
    reasons.push(`invalid_${label}_evidence_refs`);
  }
  if (window.freshness !== 'fresh') reasons.push(`${label}_window_not_fresh`);
  return reasons;
}

/**
 * Agent-5 V1 read-only traffic diagnostic adapter.
 *
 * V1 intentionally supports one deterministic signal only: a confirmed total
 * traffic session decline for the same product scope across non-overlapping,
 * comparable windows, when the upstream read-only collector explicitly marks
 * the sample comparable and sufficient. Cause is deliberately left unassigned.
 */
export function runAgent5TrafficSignal(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  const reasons = [];
  if (!ALLOWED_INPUT_MODES.has(input.input_mode)) reasons.push('invalid_input_mode');
  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) reasons.push(`privilege_injection_${key}`);
  }
  reasons.push(...validateScope(input.scope));
  reasons.push(...validateWindow(input.baseline_window, 'baseline'));
  reasons.push(...validateWindow(input.current_window, 'current'));
  if (reasons.length) return failClosed(reasons);

  const baseline = input.baseline_window;
  const current = input.current_window;
  if (Date.parse(baseline.end_at) > Date.parse(current.start_at)) {
    return failClosed(['traffic_window_lineage_overlap']);
  }
  if (input.sample_comparable !== true || input.sample_sufficient !== true) {
    return observe('needs_confirmation', ['traffic_sample_not_explicitly_comparable_and_sufficient']);
  }
  if (baseline.sessions <= 0) {
    return observe('needs_recheck', ['baseline_has_no_sessions']);
  }
  if (current.sessions >= baseline.sessions) {
    return observe('no_confirmed_decline', ['current_sessions_not_below_baseline']);
  }

  const declineRatio = (baseline.sessions - current.sessions) / baseline.sessions;
  if (declineRatio < 0.2) {
    return observe('needs_recheck', ['decline_below_v1_materiality_threshold']);
  }

  const evidenceRefs = [...new Set([...baseline.evidence_refs, ...current.evidence_refs])];
  const generatedAt = options.generatedAt ?? current.end_at;
  if (!validDateTime(generatedAt)) return failClosed(['invalid_generated_at']);

  const requestId = nonEmptyString(input.request_id)
    ? input.request_id
    : `A5-REQ:${input.scope.product_id}:${current.window_id}`;
  const declinePct = Number((declineRatio * 100).toFixed(2));
  const diagnosisText = `Product traffic sessions declined ${declinePct}% from ${baseline.sessions} to ${current.sessions} across comparable windows; cause remains unassigned.`;
  const responseFacts = [
    `Baseline window ${baseline.window_id}: ${baseline.sessions} sessions.`,
    `Current window ${current.window_id}: ${current.sessions} sessions.`,
    'Upstream collector marked both windows comparable and the sample sufficient.',
  ];

  const domainResponse = {
    request_id: requestId,
    responder_agent: 'Agent-5',
    status: 'completed',
    scope: { ...input.scope },
    facts: responseFacts.map((fact) => ({ fact })),
    diagnoses: [{ diagnosis: diagnosisText, confidence: 'high', evidence_refs: evidenceRefs }],
    recommendation_candidates: [{
      candidate: 'Request source-level traffic decomposition before assigning cause or proposing any operational change.',
      action_authorized: false,
    }],
    evidence_refs: evidenceRefs,
    data_quality: { sample_comparable: true, sample_sufficient: true, freshness: 'fresh' },
    missing_inputs: [],
    limitations: ['Agent-5 traffic diagnosis does not authorize listing, advertising, pricing, inventory, promotion, or other production changes.'],
    cross_agent_dependencies: [
      { agent: 'Agent-4', reason: 'Separate paid traffic evidence before advertising attribution.' },
      { agent: 'Agent-8', reason: 'Confirm market-demand or seasonality explanations before assigning external cause.' },
    ],
    generated_at: generatedAt,
  };

  const normalizedResponse = normalizeProfessionalAgentResponse({
    source_agent: 'Agent-5',
    request_id: requestId,
    status: domainResponse.status,
    analysis_scope: domainResponse.scope,
    facts: responseFacts,
    interpretation: [diagnosisText],
    conclusion: 'A material product-level traffic decline is confirmed for the observed windows; source and cause remain unassigned.',
    recommendation: 'Decompose traffic sources and request relevant cross-Agent evidence before any action.',
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

  const domainEventId = `A5:${input.scope.product_id}:${baseline.window_id}:${current.window_id}:traffic_session_decline`;
  const domainEvent = {
    event_id: domainEventId,
    source_agent: 'Agent-5',
    event_type: 'traffic_session_decline',
    scope: { ...input.scope },
    affected_sources: ['unknown'],
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
    metric_deltas: [{ metric: 'sessions', baseline: baseline.sessions, current: current.sessions, delta: current.sessions - baseline.sessions }],
    metrics: {
      product_id: input.scope.product_id,
      marketplace: input.scope.marketplace ?? null,
      baseline_window_id: baseline.window_id,
      current_window_id: current.window_id,
      baseline_sessions: baseline.sessions,
      current_sessions: current.sessions,
      decline_pct: declinePct,
    },
    cause_candidates: [],
    recommendation: 'Decompose paid, organic, other onsite, offsite, and unknown traffic before assigning cause; no action is authorized.',
    cross_agent_requests: domainResponse.cross_agent_dependencies,
    data_quality: domainResponse.data_quality,
  };

  const normalizedEvent = normalizeProfessionalAgentEvent({
    source_agent: 'Agent-5',
    domain_schema: 'TrafficIntelligenceEvent.v1',
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
    runtimeVersion: A5_TRAFFIC_RUNTIME_VERSION,
    domainResponse,
    normalizedResponse,
    domainEvent,
    normalizedEvent,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
