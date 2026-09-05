import { runAgent7LowCoverage } from './a7-inventory-supply-runtime.js';
import { validateS01, S01_VALIDATOR_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S01_事件校验/执行程序/runtime.js';

export const A7_A1_INTAKE_RUNTIME_VERSION = 'A7-A1-intake-runtime-v1.0.0';
const PRIVILEGE_KEYS = new Set([
  'executionAuthorized', 'dispatchAuthorized', 'permissionGranted', 'stateTransitionAuthorized',
  'productionWriteAuthorized', 'approvalGranted', 'taskAuthorized', 'finalDecision', 'task',
  'purchaseOrder', 'transferOrder', 'removalOrder',
]);
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;

function failClosed(reasons, agent7Result = null, s01Result = null) {
  return {
    status: 'blocked', nextAction: 'hold_for_review', reasons: [...new Set(reasons)],
    runtimeVersion: A7_A1_INTAKE_RUNTIME_VERSION, validatorVersion: S01_VALIDATOR_VERSION,
    agent7Result, s01Result, canonicalEvent: null, readOnly: true,
    approvalGranted: false, permissionGranted: false, taskAuthorized: false,
    executionAuthorized: false, dispatchAuthorized: false, productionWriteAuthorized: false,
  };
}

export function runAgent7ToA1Intake(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_bridge_input']);
  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) return failClosed([`privilege_injection_${key}`]);
  }

  const agent7Result = runAgent7LowCoverage(input, {
    receivedAt: options.receivedAt,
    mappedAt: options.mappedAt,
    generatedAt: options.generatedAt,
  });
  if (agent7Result.status !== 'event_and_response_ready') {
    return {
      ...failClosed(agent7Result.reasons ?? ['agent7_not_ready'], agent7Result),
      status: agent7Result.status,
      nextAction: agent7Result.nextAction,
    };
  }

  const normalized = agent7Result.normalizedEvent;
  const event = normalized?.canonicalEvent;
  if (!normalized || normalized.status !== 'normalized' || !event) return failClosed(['missing_verified_r16_canonical_event'], agent7Result);
  if (normalized.nextAction !== 'continue_to_A1_event_intake') return failClosed(['r16_route_not_allowed_for_a1_intake'], agent7Result);
  if (event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-7') return failClosed(['canonical_source_lineage_mismatch'], agent7Result);
  if (event.event_type !== 'LOW_COVERAGE') return failClosed(['canonical_event_type_not_allowed'], agent7Result);

  const productId = input.scope?.product_id ?? null;
  if (!text(productId) || event.product_id !== productId) return failClosed(['canonical_product_lineage_mismatch'], agent7Result);
  if (event.scope_type !== 'product' || event.scope_id !== input.scope?.scope_id) return failClosed(['canonical_scope_lineage_mismatch'], agent7Result);
  if (event.metrics?.product_id !== productId) return failClosed(['canonical_inventory_product_metric_lineage_mismatch'], agent7Result);
  if (event.metrics?.available_units !== input.inventory_snapshot?.available_units) return failClosed(['canonical_inventory_snapshot_lineage_mismatch'], agent7Result);
  if (event.metrics?.daily_units !== input.demand_baseline?.daily_units) return failClosed(['canonical_demand_baseline_lineage_mismatch'], agent7Result);
  if (event.metrics?.lead_time_days !== input.lead_time_days || event.metrics?.safety_stock_days !== input.safety_stock_days) return failClosed(['canonical_supply_threshold_lineage_mismatch'], agent7Result);

  const expectedCoverage = Number((input.inventory_snapshot.available_units / input.demand_baseline.daily_units).toFixed(2));
  if (event.metrics?.coverage_days !== expectedCoverage) return failClosed(['canonical_coverage_lineage_mismatch'], agent7Result);

  const s01Result = validateS01({
    event,
    known_product_ids: Array.isArray(options.knownProductIds) ? options.knownProductIds : [productId],
    existing_events: Array.isArray(options.existingEvents) ? options.existingEvents : [],
    current_time: options.currentTime ?? event.received_at ?? event.occurred_at,
    allowed_sources: ['professional_agent', 'Agent-7'],
  });
  if (!['passed', 'passed_with_warnings'].includes(s01Result.status)) {
    return {
      ...failClosed(['a1_s01_intake_not_ready', ...(s01Result.blocking_errors ?? []).map((item) => item.code)], agent7Result, s01Result),
      nextAction: s01Result.next_action === 'request_information' ? 'request_information' : 'hold_for_review',
    };
  }
  if (s01Result.next_action !== 'continue_to_S02' || !s01Result.normalized_event) return failClosed(['a1_s01_route_not_allowed'], agent7Result, s01Result);
  if (s01Result.normalized_event.event_id !== event.event_id || s01Result.normalized_event.source_agent !== 'Agent-7' || s01Result.normalized_event.product_id !== productId) return failClosed(['a1_s01_lineage_mismatch'], agent7Result, s01Result);

  return {
    status: 'ready_for_S02', nextAction: 'continue_to_S02', reasons: [],
    runtimeVersion: A7_A1_INTAKE_RUNTIME_VERSION, validatorVersion: S01_VALIDATOR_VERSION,
    agent7Result, s01Result, canonicalEvent: s01Result.normalized_event, readOnly: true,
    approvalGranted: false, permissionGranted: false, taskAuthorized: false,
    executionAuthorized: false, dispatchAuthorized: false, productionWriteAuthorized: false,
  };
}
