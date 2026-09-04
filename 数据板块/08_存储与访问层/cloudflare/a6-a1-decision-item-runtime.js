import { runAgent6ToS03 } from './a6-a1-s03-runtime.js';
import {
  runDecisionItemBuilder,
  DECISION_ITEM_BUILDER_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/统一接口/执行程序/decision-item-builder.runtime.js';

export const A6_A1_DECISION_ITEM_RUNTIME_VERSION = 'A6-A1-DecisionItem-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'executionAuthorized','dispatchAuthorized','permissionGranted','stateTransitionAuthorized',
  'productionWriteAuthorized','approvalGranted','taskAuthorized','finalDecision','task',
]);
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function failClosed(reasons, s03BridgeResult = null, builderResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A6_A1_DECISION_ITEM_RUNTIME_VERSION,
    builderRuntimeVersion: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
    s03BridgeResult,
    builderResult,
    canonicalEvent: null,
    contextPackage: null,
    decisionItems: [],
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}

function validateLineage(input, s03BridgeResult) {
  const reasons = [];
  const event = s03BridgeResult?.canonicalEvent;
  const contextPackage = s03BridgeResult?.contextPackage;
  const s03Result = s03BridgeResult?.s03Result;
  const s02BridgeResult = s03BridgeResult?.s02BridgeResult;

  if (!isObject(event)) return ['missing_agent6_canonical_event'];
  if (event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-6') reasons.push('agent6_event_source_lineage_mismatch');
  if (event.event_type !== 'MARGIN_COMPRESSION') reasons.push('agent6_event_type_not_allowed_for_builder');

  const productId = input?.scope?.product_id ?? null;
  const scopeId = input?.scope?.scope_id ?? null;
  if (!nonEmptyString(productId) || event.product_id !== productId || event.scope_type !== 'product' || event.scope_id !== scopeId) {
    reasons.push('agent6_product_scope_lineage_mismatch');
  }
  if (event.metrics?.product_id !== productId) reasons.push('agent6_financial_product_metric_lineage_mismatch');
  if (event.metrics?.baseline_window_id !== input?.baseline_window?.window_id || event.metrics?.current_window_id !== input?.current_window?.window_id) {
    reasons.push('agent6_financial_window_lineage_mismatch');
  }
  if (event.metrics?.cost_model_version !== input?.current_window?.cost_model_version || event.metrics?.currency !== input?.current_window?.currency) {
    reasons.push('agent6_financial_basis_lineage_mismatch');
  }
  if (!isObject(contextPackage) || Object.keys(contextPackage).length === 0) reasons.push('missing_context_package');
  if (!isObject(s03Result) || s03Result.event_id !== event.event_id) reasons.push('s03_event_lineage_mismatch');
  if (s03Result?.next_action !== 'continue_to_decision_item_builder') reasons.push('s03_not_verified_for_builder');
  if (s03Result?.scope?.scope_type !== event.scope_type
      || (s03Result?.scope?.scope_id ?? null) !== (event.scope_id ?? event.product_id ?? null)
      || (s03Result?.scope?.product_id ?? null) !== (event.product_id ?? null)) {
    reasons.push('s03_scope_lineage_mismatch');
  }

  const intakeEventId = s02BridgeResult?.intakeResult?.canonicalEvent?.event_id ?? null;
  const s01EventId = s02BridgeResult?.intakeResult?.s01Result?.normalized_event?.event_id ?? null;
  const r16EventId = s02BridgeResult?.intakeResult?.agent6Result?.normalizedEvent?.canonicalEvent?.event_id ?? null;
  const financialEventId = s02BridgeResult?.intakeResult?.agent6Result?.financialEvent?.event_id ?? null;
  if (event.event_id !== intakeEventId || event.event_id !== s01EventId || event.event_id !== r16EventId || event.event_id !== financialEventId) {
    reasons.push('agent6_event_identity_lineage_mismatch');
  }
  return reasons;
}

/**
 * Read-only Agent-6 -> DecisionItemBuilder bridge.
 * Re-runs Agent-6 -> R16 -> S01 -> S02 -> S03, validates financial event,
 * product/scope/window/cost-basis/context lineage, then builds DecisionItem V1.
 * Stops before S04 and grants no approval, permission, task, execution,
 * dispatch, state-transition, or production-write authority.
 */
export function runAgent6ToDecisionItem(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);
  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) return failClosed([`privilege_injection_${key}`]);
  }

  const s03BridgeResult = runAgent6ToS03(input, options);
  if (s03BridgeResult.status !== 'ready_for_decision_item_builder') {
    return {
      ...failClosed(s03BridgeResult.reasons ?? ['agent6_s03_not_ready'], s03BridgeResult),
      status: s03BridgeResult.status,
      nextAction: s03BridgeResult.nextAction,
      canonicalEvent: s03BridgeResult.canonicalEvent ?? null,
      contextPackage: s03BridgeResult.contextPackage ?? null,
    };
  }
  if (s03BridgeResult.nextAction !== 'continue_to_decision_item_builder') {
    return failClosed(['s03_bridge_route_not_allowed_for_builder'], s03BridgeResult);
  }

  const lineageReasons = validateLineage(input, s03BridgeResult);
  if (lineageReasons.length) return failClosed(lineageReasons, s03BridgeResult);

  const event = s03BridgeResult.canonicalEvent;
  const contextPackage = s03BridgeResult.contextPackage;
  const s03Result = s03BridgeResult.s03Result;
  const s02Result = s03BridgeResult.s02BridgeResult?.s02Result;
  const builderResult = runDecisionItemBuilder({
    scope: {
      scope_type: event.scope_type,
      scope_id: event.scope_id ?? event.product_id ?? null,
      product_id: event.product_id ?? null,
      asin: event.asin ?? null,
    },
    source_event_refs: [event.event_id],
    context_package: contextPackage,
    context_refs: Array.isArray(s02Result?.context_refs) ? s02Result.context_refs : [],
    conflicts: Array.isArray(s03Result.conflicts) ? s03Result.conflicts : [],
    conflict_groups: Array.isArray(s03Result.conflict_groups) ? s03Result.conflict_groups : [],
    s03_next_action: s03Result.next_action,
    current_time: options.currentTime ?? event.received_at ?? event.occurred_at,
  });

  if (!isObject(builderResult)) return failClosed(['missing_builder_result'], s03BridgeResult);
  if (builderResult.runtime_version !== DECISION_ITEM_BUILDER_RUNTIME_VERSION) {
    return failClosed(['builder_runtime_version_mismatch'], s03BridgeResult, builderResult);
  }
  if (builderResult.next_action !== 'continue_to_S04') {
    return {
      ...failClosed(builderResult.builder_notes ?? ['builder_not_ready_for_S04'], s03BridgeResult, builderResult),
      status: builderResult.next_action === 'request_more_context' ? 'needs_information' : 'blocked',
      nextAction: builderResult.next_action === 'request_more_context' ? 'request_more_context' : 'hold_for_review',
      canonicalEvent: event,
      contextPackage,
    };
  }
  if (!Array.isArray(builderResult.decision_items) || builderResult.decision_items.length === 0) {
    return failClosed(['builder_returned_no_decision_items'], s03BridgeResult, builderResult);
  }
  if (builderResult.decision_items.some((item) => !Array.isArray(item.source_event_refs) || !item.source_event_refs.includes(event.event_id))) {
    return failClosed(['decision_item_event_lineage_mismatch'], s03BridgeResult, builderResult);
  }

  return {
    status: 'ready_for_S04',
    nextAction: 'continue_to_S04',
    reasons: [],
    runtimeVersion: A6_A1_DECISION_ITEM_RUNTIME_VERSION,
    builderRuntimeVersion: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
    s03BridgeResult,
    builderResult,
    canonicalEvent: event,
    contextPackage,
    decisionItems: builderResult.decision_items,
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}
