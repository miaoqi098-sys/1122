import {
  normalizeProfessionalAgentEvent,
  normalizeProfessionalAgentResponse,
} from './r16-professional-agent-event-normalizer.js';

export const A7_INVENTORY_SUPPLY_RUNTIME_VERSION = 'A7-inventory-supply-runtime-v1.0.0';

const ALLOWED_INPUT_MODES = new Set(['simulated', 'trusted_read_only']);
const PRIVILEGE_KEYS = new Set([
  'approvalGranted', 'permissionGranted', 'taskAuthorized', 'executionAuthorized',
  'dispatchAuthorized', 'stateTransitionAuthorized', 'productionWriteAuthorized',
  'finalDecision', 'task', 'purchaseOrder', 'transferOrder', 'removalOrder',
]);

function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function nonEmptyString(value) { return typeof value === 'string' && value.trim().length > 0; }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function validDateTime(value) { return nonEmptyString(value) && Number.isFinite(Date.parse(value)); }

function failClosed(reasons) {
  return {
    status: 'blocked', nextAction: 'hold_for_review', reasons: [...new Set(reasons)],
    runtimeVersion: A7_INVENTORY_SUPPLY_RUNTIME_VERSION,
    domainResponse: null, normalizedResponse: null, inventorySupplyEvent: null, normalizedEvent: null,
    readOnly: true, approvalGranted: false, permissionGranted: false, taskAuthorized: false,
    executionAuthorized: false, dispatchAuthorized: false, productionWriteAuthorized: false,
  };
}

function observe(status, reasons) {
  return { ...failClosed(reasons), status, nextAction: 'observe' };
}

export function runAgent7LowCoverage(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);
  const reasons = [];
  if (!ALLOWED_INPUT_MODES.has(input.input_mode)) reasons.push('invalid_input_mode');
  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) reasons.push(`privilege_injection_${key}`);
  }
  if (!isObject(input.scope) || input.scope.scope_type !== 'product' || !nonEmptyString(input.scope.scope_id) || !nonEmptyString(input.scope.product_id)) reasons.push('invalid_product_scope');
  if (!isObject(input.inventory_snapshot) || !nonEmptyString(input.inventory_snapshot.snapshot_id) || !validDateTime(input.inventory_snapshot.observed_at)) reasons.push('invalid_inventory_snapshot');
  if (!finite(input.inventory_snapshot?.available_units) || input.inventory_snapshot.available_units < 0) reasons.push('invalid_available_units');
  if (input.inventory_snapshot?.freshness !== 'fresh') reasons.push('inventory_snapshot_not_fresh');
  if (!isObject(input.demand_baseline) || !nonEmptyString(input.demand_baseline.baseline_id) || !finite(input.demand_baseline.daily_units) || input.demand_baseline.daily_units <= 0) reasons.push('invalid_demand_baseline');
  if (input.demand_baseline?.freshness !== 'fresh') reasons.push('demand_baseline_not_fresh');
  if (!finite(input.lead_time_days) || input.lead_time_days <= 0) reasons.push('invalid_lead_time_days');
  if (!finite(input.safety_stock_days) || input.safety_stock_days < 0) reasons.push('invalid_safety_stock_days');
  if (!Array.isArray(input.evidence_refs) || input.evidence_refs.length === 0 || input.evidence_refs.some((ref) => !nonEmptyString(ref))) reasons.push('invalid_evidence_refs');
  if (reasons.length) return failClosed(reasons);

  const coverageDays = input.inventory_snapshot.available_units / input.demand_baseline.daily_units;
  const reviewThresholdDays = input.lead_time_days + input.safety_stock_days;
  if (coverageDays >= reviewThresholdDays) return observe('no_confirmed_low_coverage', ['coverage_meets_or_exceeds_review_threshold']);

  const evidenceRefs = [...new Set(input.evidence_refs)];
  const observedAt = input.inventory_snapshot.observed_at;
  const generatedAt = options.generatedAt ?? observedAt;
  if (!validDateTime(generatedAt)) return failClosed(['invalid_generated_at']);
  const requestId = nonEmptyString(input.request_id) ? input.request_id : `A7-REQ:${input.scope.product_id}:${input.inventory_snapshot.snapshot_id}`;
  const eventId = `A7:${input.scope.product_id}:${input.inventory_snapshot.snapshot_id}:LOW_COVERAGE`;
  const severity = coverageDays < input.lead_time_days ? 'high' : 'medium';
  const coverageRounded = Number(coverageDays.toFixed(2));
  const thresholdRounded = Number(reviewThresholdDays.toFixed(2));
  const diagnosis = `Fresh read-only inventory coverage is ${coverageRounded} days, below the ${thresholdRounded}-day lead-time plus safety-stock review threshold.`;
  const facts = [
    `Available inventory is ${input.inventory_snapshot.available_units} units in snapshot ${input.inventory_snapshot.snapshot_id}.`,
    `Fresh demand baseline is ${input.demand_baseline.daily_units} units/day from ${input.demand_baseline.baseline_id}.`,
    `Lead time is ${input.lead_time_days} days and safety-stock review buffer is ${input.safety_stock_days} days.`,
  ];

  const domainResponse = {
    request_id: requestId,
    responder_agent: 'Agent-7',
    status: 'completed',
    scope: { ...input.scope },
    facts: facts.map((fact) => ({ fact })),
    diagnoses: [{ diagnosis, confidence: 'high', evidence_refs: evidenceRefs }],
    recommendation_candidates: [{ candidate: 'Escalate the verified low-coverage evidence to Agent-1 for review; do not create purchase, transfer, removal, pricing, advertising, listing, or other production actions.', action_authorized: false }],
    evidence_refs: evidenceRefs,
    data_quality: { inventory_freshness: 'fresh', demand_freshness: 'fresh' },
    missing_inputs: [],
    limitations: ['Agent-7 V1 is advisory and read-only; it cannot mutate inventory or any Amazon production state.'],
    cross_agent_dependencies: [],
    generated_at: generatedAt,
  };

  const normalizedResponse = normalizeProfessionalAgentResponse({
    source_agent: 'Agent-7', request_id: requestId, status: 'completed', analysis_scope: domainResponse.scope,
    facts, interpretation: [diagnosis], conclusion: 'A material low-coverage supply risk is confirmed from fresh read-only inputs.',
    recommendation: 'Escalate to Agent-1 for review; no production action is authorized.', confidence: 'high',
    data_window: observedAt, evidence_refs: evidenceRefs, missing_data: [], risks: domainResponse.limitations,
    generated_at: generatedAt, cross_agent_dependencies: [],
  });
  if (normalizedResponse.status !== 'normalized') return failClosed(['r16_response_normalization_failed', ...(normalizedResponse.reasons ?? [])]);

  const inventorySupplyEvent = {
    event_id: eventId, agent_id: 'Agent-7', event_type: 'LOW_COVERAGE', scope: { ...input.scope },
    observed_at: observedAt, severity, confidence: 0.9,
    inventory_state: { snapshot_id: input.inventory_snapshot.snapshot_id, available_units: input.inventory_snapshot.available_units, coverage_days: coverageRounded },
    demand_baseline: { baseline_id: input.demand_baseline.baseline_id, daily_units: input.demand_baseline.daily_units },
    supply_timeline: [], projected_stockout_at: null, projected_overstock_days: null,
    recommended_review_window: `before ${thresholdRounded} days of coverage are consumed`, requires_other_agents: [],
    evidence: evidenceRefs.map((ref) => ({ ref })), source_refs: evidenceRefs,
  };

  const normalizedEvent = normalizeProfessionalAgentEvent({
    source_agent: 'Agent-7', domain_schema: 'InventorySupplyEvent.v1', domain_event_id: eventId,
    domain_event: {
      event_id: eventId, event_type: 'LOW_COVERAGE', scope: { ...input.scope }, severity, confidence: 0.9,
      observed_at: observedAt, summary: diagnosis, facts, evidence_refs: evidenceRefs,
      metrics: { product_id: input.scope.product_id, available_units: input.inventory_snapshot.available_units, daily_units: input.demand_baseline.daily_units, coverage_days: coverageRounded, lead_time_days: input.lead_time_days, safety_stock_days: input.safety_stock_days },
      recommendation: 'Escalate to Agent-1 for review; no production action is authorized.',
    },
  }, { receivedAt: options.receivedAt ?? observedAt, mappedAt: options.mappedAt ?? observedAt });
  if (normalizedEvent.status !== 'normalized') return failClosed(['r16_event_normalization_failed', ...(normalizedEvent.reasons ?? [])]);

  return {
    status: 'event_and_response_ready', nextAction: 'stop_before_A1_intake', reasons: [],
    runtimeVersion: A7_INVENTORY_SUPPLY_RUNTIME_VERSION, domainResponse, normalizedResponse,
    inventorySupplyEvent, normalizedEvent, readOnly: true, approvalGranted: false, permissionGranted: false,
    taskAuthorized: false, executionAuthorized: false, dispatchAuthorized: false, productionWriteAuthorized: false,
  };
}
