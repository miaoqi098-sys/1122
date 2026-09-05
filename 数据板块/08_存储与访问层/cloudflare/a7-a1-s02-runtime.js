import { runAgent7ToA1Intake } from './a7-a1-intake-runtime.js';
import { buildDefaultContextRequest } from './s02-context.js';
import {
  planContextDomains,
  runS02,
  S02_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S02_上下文装载/执行程序/runtime.js';

export const A7_A1_S02_RUNTIME_VERSION = 'A7-A1-S02-runtime-v1.0.0';
const PRIVILEGE_KEYS = new Set([
  'executionAuthorized', 'dispatchAuthorized', 'permissionGranted', 'stateTransitionAuthorized',
  'productionWriteAuthorized', 'approvalGranted', 'taskAuthorized', 'finalDecision', 'task',
  'purchaseOrder', 'transferOrder', 'removalOrder',
]);
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;

function failClosed(reasons, intakeResult = null, s02Result = null) {
  return {
    status: 'blocked', nextAction: 'hold_for_review', reasons: [...new Set(reasons)],
    runtimeVersion: A7_A1_S02_RUNTIME_VERSION, s02RuntimeVersion: S02_RUNTIME_VERSION,
    intakeResult, s02Result, canonicalEvent: null, contextPackage: null, readOnly: true,
    approvalGranted: false, permissionGranted: false, taskAuthorized: false,
    executionAuthorized: false, dispatchAuthorized: false, productionWriteAuthorized: false,
  };
}

function validateLineage(input, intakeResult) {
  const reasons = [];
  const event = intakeResult?.canonicalEvent;
  const normalized = intakeResult?.agent7Result?.normalizedEvent;
  const domainEvent = intakeResult?.agent7Result?.inventorySupplyEvent;
  if (!isObject(event)) return ['missing_a1_normalized_event'];
  if (!isObject(normalized?.canonicalEvent) || !isObject(domainEvent)) return ['missing_agent7_r16_lineage'];
  if (event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-7') reasons.push('a1_event_source_lineage_mismatch');
  if (event.event_type !== 'LOW_COVERAGE') reasons.push('a1_event_type_not_allowed');
  if (event.event_id !== normalized.canonicalEvent.event_id || event.event_id !== domainEvent.event_id || event.source_ref !== domainEvent.event_id) reasons.push('agent7_event_identity_lineage_mismatch');
  const productId = input.scope?.product_id ?? null;
  if (!text(productId) || event.product_id !== productId || event.scope_type !== 'product' || event.scope_id !== input.scope?.scope_id) reasons.push('agent7_product_scope_lineage_mismatch');
  if (event.metrics?.product_id !== productId) reasons.push('agent7_inventory_product_metric_lineage_mismatch');
  if (event.metrics?.available_units !== input.inventory_snapshot?.available_units || event.metrics?.daily_units !== input.demand_baseline?.daily_units) reasons.push('agent7_inventory_demand_lineage_mismatch');
  const expectedCoverage = Number((input.inventory_snapshot?.available_units / input.demand_baseline?.daily_units).toFixed(2));
  if (event.metrics?.coverage_days !== expectedCoverage) reasons.push('agent7_coverage_lineage_mismatch');
  if (event.metrics?.lead_time_days !== input.lead_time_days || event.metrics?.safety_stock_days !== input.safety_stock_days) reasons.push('agent7_supply_threshold_lineage_mismatch');
  if (intakeResult.s01Result?.normalized_event?.event_id !== event.event_id || intakeResult.s01Result?.normalized_event?.source_agent !== 'Agent-7' || intakeResult.s01Result?.normalized_event?.product_id !== productId) reasons.push('a1_s01_lineage_mismatch');
  return reasons;
}

export function runAgent7ToS02(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);
  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) return failClosed([`privilege_injection_${key}`]);
  }
  if (!isObject(options.availableContext)) return failClosed(['missing_available_context']);

  const intakeResult = runAgent7ToA1Intake(input, options);
  if (intakeResult.status !== 'ready_for_S02') {
    return { ...failClosed(intakeResult.reasons ?? ['agent7_intake_not_ready'], intakeResult), status: intakeResult.status, nextAction: intakeResult.nextAction };
  }
  if (intakeResult.nextAction !== 'continue_to_S02' || !['passed', 'passed_with_warnings'].includes(intakeResult.s01Result?.status)) return failClosed(['a1_s01_not_verified'], intakeResult);
  const lineageReasons = validateLineage(input, intakeResult);
  if (lineageReasons.length) return failClosed(lineageReasons, intakeResult);

  const event = intakeResult.canonicalEvent;
  const contextRequest = { ...buildDefaultContextRequest(event), ...(isObject(options.contextRequest) ? options.contextRequest : {}) };
  const plannedDomains = planContextDomains(event, contextRequest);
  const s02Result = runS02({
    validated_event: event,
    s01_validation: {
      status: intakeResult.s01Result.status,
      warnings: intakeResult.s01Result.warnings ?? [],
      duplicate_signal: intakeResult.s01Result.duplicate_signal ?? {},
      validation_summary: intakeResult.s01Result.validation_summary ?? null,
      validator_version: intakeResult.s01Result.validator_version ?? null,
    },
    context_request: contextRequest,
    available_context: options.availableContext,
    current_time: options.currentTime ?? event.received_at ?? event.occurred_at,
  });

  if (!isObject(s02Result)) return failClosed(['missing_s02_result'], intakeResult);
  if (s02Result.status === 'blocked') return failClosed(['s02_blocked', ...(s02Result.missing_context ?? []).map((item) => `missing:${item.domain ?? 'unknown'}`)], intakeResult, s02Result);
  if (s02Result.status === 'needs_information') {
    return {
      status: 'needs_information', nextAction: s02Result.next_action === 'refresh_context' ? 'refresh_context' : 'request_information',
      reasons: (s02Result.missing_context ?? []).map((item) => `missing:${item.domain ?? 'unknown'}`),
      runtimeVersion: A7_A1_S02_RUNTIME_VERSION, s02RuntimeVersion: S02_RUNTIME_VERSION,
      intakeResult, s02Result, canonicalEvent: event, contextPackage: null, readOnly: true,
      approvalGranted: false, permissionGranted: false, taskAuthorized: false,
      executionAuthorized: false, dispatchAuthorized: false, productionWriteAuthorized: false,
    };
  }
  if (!['ready', 'ready_with_gaps'].includes(s02Result.status) || s02Result.next_action !== 'continue_analysis') return failClosed(['s02_route_not_allowed'], intakeResult, s02Result);
  if (!isObject(s02Result.context_package) || Object.keys(s02Result.context_package).length === 0) return failClosed(['empty_s02_context_package'], intakeResult, s02Result);
  if (s02Result.scope?.product_id !== event.product_id) return failClosed(['s02_product_lineage_mismatch'], intakeResult, s02Result);
  const productIdentity = s02Result.context_package.C01_product_identity;
  if (!isObject(productIdentity) || productIdentity.product_id !== event.product_id || (text(event.asin) && productIdentity.asin !== event.asin)) {
    return failClosed(['s02_product_identity_context_mismatch'], intakeResult, s02Result);
  }

  return {
    status: 'ready_for_S03', nextAction: 'continue_to_S03', reasons: [],
    runtimeVersion: A7_A1_S02_RUNTIME_VERSION, s02RuntimeVersion: S02_RUNTIME_VERSION,
    plannedDomains, intakeResult, s02Result, canonicalEvent: event, contextPackage: s02Result.context_package,
    readOnly: true, approvalGranted: false, permissionGranted: false, taskAuthorized: false,
    executionAuthorized: false, dispatchAuthorized: false, productionWriteAuthorized: false,
  };
}
