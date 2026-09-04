import {
  normalizeProfessionalAgentEvent,
  normalizeProfessionalAgentResponse,
} from './r16-professional-agent-event-normalizer.js';

export const A6_FINANCIAL_RUNTIME_VERSION = 'A6-financial-runtime-v1.0.0';

const ALLOWED_INPUT_MODES = new Set(['simulated', 'trusted_read_only']);
const PRIVILEGE_KEYS = new Set([
  'approvalGranted',
  'permissionGranted',
  'taskAuthorized',
  'executionAuthorized',
  'dispatchAuthorized',
  'stateTransitionAuthorized',
  'productionWriteAuthorized',
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

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function failClosed(reasons) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A6_FINANCIAL_RUNTIME_VERSION,
    domainResponse: null,
    normalizedResponse: null,
    financialEvent: null,
    normalizedEvent: null,
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}

function observe(status, reasons = []) {
  return {
    ...failClosed(reasons),
    status,
    nextAction: 'observe',
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
  if (!finite(window.revenue) || window.revenue <= 0) reasons.push(`invalid_${label}_revenue`);
  if (!finite(window.contribution_profit)) reasons.push(`invalid_${label}_contribution_profit`);
  if (!finite(window.contribution_margin_pct) || window.contribution_margin_pct < -1 || window.contribution_margin_pct > 1) {
    reasons.push(`invalid_${label}_contribution_margin_pct`);
  }
  if (!nonEmptyString(window.currency)) reasons.push(`missing_${label}_currency`);
  if (!nonEmptyString(window.cost_model_version)) reasons.push(`missing_${label}_cost_model_version`);
  if (window.cost_complete !== true) reasons.push(`${label}_cost_basis_not_complete`);
  if (window.freshness !== 'fresh') reasons.push(`${label}_window_not_fresh`);
  if (!Array.isArray(window.evidence_refs) || window.evidence_refs.length === 0 || window.evidence_refs.some((ref) => !nonEmptyString(ref))) {
    reasons.push(`invalid_${label}_evidence_refs`);
  }
  if (finite(window.revenue) && window.revenue > 0 && finite(window.contribution_profit) && finite(window.contribution_margin_pct)) {
    const calculated = window.contribution_profit / window.revenue;
    if (Math.abs(calculated - window.contribution_margin_pct) > 0.001) {
      reasons.push(`${label}_margin_reconciliation_failed`);
    }
  }
  return reasons;
}

/**
 * Agent-6 V1 read-only financial diagnostic adapter.
 *
 * V1 supports one narrow signal: contribution-margin compression for the same
 * product across non-overlapping, explicitly comparable windows, with fresh,
 * complete and reconciled cost evidence under the same cost model/currency.
 * It is advisory only and stops before A1 intake.
 */
export function runAgent6MarginCompression(input, options = {}) {
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
    return failClosed(['financial_window_lineage_overlap']);
  }
  if (baseline.currency !== current.currency) {
    return failClosed(['currency_lineage_mismatch']);
  }
  if (baseline.cost_model_version !== current.cost_model_version) {
    return failClosed(['cost_model_version_mismatch']);
  }
  if (input.sample_comparable !== true || input.sample_sufficient !== true) {
    return observe('needs_confirmation', ['financial_sample_not_explicitly_comparable_and_sufficient']);
  }
  if (current.contribution_profit < 0 || current.contribution_margin_pct < 0) {
    return observe('needs_reclassification', ['loss_making_signal_requires_separate_runtime']);
  }

  const compression = baseline.contribution_margin_pct - current.contribution_margin_pct;
  if (compression <= 0) {
    return observe('no_confirmed_compression', ['current_margin_not_below_baseline']);
  }
  if (compression < 0.05) {
    return observe('needs_recheck', ['margin_compression_below_v1_materiality_threshold']);
  }

  const evidenceRefs = [...new Set([...baseline.evidence_refs, ...current.evidence_refs])];
  const generatedAt = options.generatedAt ?? current.end_at;
  if (!validDateTime(generatedAt)) return failClosed(['invalid_generated_at']);

  const requestId = nonEmptyString(input.request_id)
    ? input.request_id
    : `A6-REQ:${input.scope.product_id}:${current.window_id}`;
  const compressionPp = Number((compression * 100).toFixed(2));
  const baselinePct = Number((baseline.contribution_margin_pct * 100).toFixed(2));
  const currentPct = Number((current.contribution_margin_pct * 100).toFixed(2));
  const severity = compression >= 0.1 ? 'high' : 'medium';
  const diagnosisText = `Contribution margin compressed ${compressionPp} percentage points from ${baselinePct}% to ${currentPct}% under the same complete cost model.`;
  const responseFacts = [
    `Baseline window ${baseline.window_id}: revenue ${baseline.revenue} ${baseline.currency}, contribution profit ${baseline.contribution_profit} ${baseline.currency}, margin ${baselinePct}%.`,
    `Current window ${current.window_id}: revenue ${current.revenue} ${current.currency}, contribution profit ${current.contribution_profit} ${current.currency}, margin ${currentPct}%.`,
    `Both windows use cost model ${current.cost_model_version}, complete cost basis, fresh evidence, and reconciled contribution-margin arithmetic.`,
  ];

  const domainResponse = {
    request_id: requestId,
    responder_agent: 'Agent-6',
    status: 'completed',
    scope: { ...input.scope },
    facts: responseFacts.map((fact) => ({ fact })),
    diagnoses: [{ diagnosis: diagnosisText, confidence: 'high', evidence_refs: evidenceRefs }],
    recommendation_candidates: [{
      candidate: 'Escalate the verified margin compression to Agent-1 and request cross-Agent evidence before proposing any operational change.',
      action_authorized: false,
    }],
    evidence_refs: evidenceRefs,
    data_quality: {
      sample_comparable: true,
      sample_sufficient: true,
      cost_complete: true,
      cost_model_version: current.cost_model_version,
      currency: current.currency,
      freshness: 'fresh',
    },
    missing_inputs: [],
    limitations: ['Agent-6 provides advisory financial evidence only and cannot change price, promotion, advertising, inventory, listing, or other production state.'],
    cross_agent_dependencies: [
      { agent: 'Agent-4', reason: 'Explain advertising-cost changes if they materially contributed.' },
      { agent: 'Agent-7', reason: 'Explain inventory/storage drivers if they materially contributed.' },
      { agent: 'Agent-10', reason: 'Explain price or promotional discount changes if they materially contributed.' },
    ],
    generated_at: generatedAt,
  };

  const normalizedResponse = normalizeProfessionalAgentResponse({
    source_agent: 'Agent-6',
    request_id: requestId,
    status: domainResponse.status,
    analysis_scope: domainResponse.scope,
    facts: responseFacts,
    interpretation: [diagnosisText],
    conclusion: 'A material contribution-margin compression is confirmed under a comparable and complete financial basis.',
    recommendation: 'Escalate to Agent-1 and obtain cross-Agent driver evidence before any action.',
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

  const domainEventId = `A6:${input.scope.product_id}:${baseline.window_id}:${current.window_id}:MARGIN_COMPRESSION`;
  const financialEvent = {
    event_id: domainEventId,
    agent_id: 'Agent-6',
    event_type: 'MARGIN_COMPRESSION',
    scope: { ...input.scope },
    observed_at: current.end_at,
    window: { baseline_window_id: baseline.window_id, current_window_id: current.window_id },
    severity,
    confidence: 0.85,
    financial_impact: {
      metric: 'contribution_margin_pct',
      direction: 'negative',
      absolute_change: Number((current.contribution_margin_pct - baseline.contribution_margin_pct).toFixed(6)),
      relative_change: baseline.contribution_margin_pct === 0
        ? null
        : Number(((current.contribution_margin_pct - baseline.contribution_margin_pct) / baseline.contribution_margin_pct).toFixed(6)),
      currency: current.currency,
      break_even_status: 'not_evaluated_in_v1',
    },
    drivers: [],
    evidence: evidenceRefs.map((ref) => ({ ref })),
    data_quality: domainResponse.data_quality,
    requires_other_agents: ['Agent-4', 'Agent-7', 'Agent-10'],
    recommended_next_step: 'Escalate to Agent-1 for cross-objective review; no production action is authorized.',
    source_refs: evidenceRefs,
  };

  const r16DomainEvent = {
    event_id: domainEventId,
    event_type: financialEvent.event_type,
    scope: { ...input.scope },
    severity: financialEvent.severity,
    confidence: financialEvent.confidence,
    observed_at: financialEvent.observed_at,
    summary: diagnosisText,
    facts: responseFacts,
    evidence_refs: evidenceRefs,
    metrics: {
      product_id: input.scope.product_id,
      marketplace: input.scope.marketplace ?? null,
      baseline_window_id: baseline.window_id,
      current_window_id: current.window_id,
      cost_model_version: current.cost_model_version,
      currency: current.currency,
      baseline_revenue: baseline.revenue,
      current_revenue: current.revenue,
      baseline_contribution_profit: baseline.contribution_profit,
      current_contribution_profit: current.contribution_profit,
      baseline_contribution_margin_pct: baseline.contribution_margin_pct,
      current_contribution_margin_pct: current.contribution_margin_pct,
      margin_compression_pp: compressionPp,
    },
    recommendation: financialEvent.recommended_next_step,
  };

  const normalizedEvent = normalizeProfessionalAgentEvent({
    source_agent: 'Agent-6',
    domain_schema: 'FinancialIntelligenceEvent.v1',
    domain_event_id: domainEventId,
    domain_event: r16DomainEvent,
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
    runtimeVersion: A6_FINANCIAL_RUNTIME_VERSION,
    domainResponse,
    normalizedResponse,
    financialEvent,
    normalizedEvent,
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}
