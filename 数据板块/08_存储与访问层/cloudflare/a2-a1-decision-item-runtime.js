import { runAgent2ToS03 } from './a2-a1-s03-runtime.js';
import {
  runDecisionItemBuilder,
  DECISION_ITEM_BUILDER_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/统一接口/执行程序/decision-item-builder.runtime.js';

export const A2_A1_DECISION_ITEM_RUNTIME_VERSION = 'A2-A1-DecisionItem-runtime-v1.0.0';

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons, s03BridgeResult = null, builderResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A2_A1_DECISION_ITEM_RUNTIME_VERSION,
    builderRuntimeVersion: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
    s03BridgeResult,
    builderResult,
    canonicalEvent: null,
    contextPackage: null,
    decisionItems: [],
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}

export function runAgent2ToDecisionItem(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  const s03BridgeResult = runAgent2ToS03(input, options);
  if (s03BridgeResult.status !== 'ready_for_decision_item_builder') {
    return {
      status: s03BridgeResult.status,
      nextAction: s03BridgeResult.nextAction,
      reasons: s03BridgeResult.reasons ?? [],
      runtimeVersion: A2_A1_DECISION_ITEM_RUNTIME_VERSION,
      builderRuntimeVersion: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
      s03BridgeResult,
      builderResult: null,
      canonicalEvent: s03BridgeResult.canonicalEvent ?? null,
      contextPackage: s03BridgeResult.contextPackage ?? null,
      decisionItems: [],
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  if (s03BridgeResult.nextAction !== 'continue_to_decision_item_builder') {
    return failClosed(['s03_bridge_route_not_allowed_for_builder'], s03BridgeResult);
  }

  const event = s03BridgeResult.canonicalEvent;
  const contextPackage = s03BridgeResult.contextPackage;
  const s03Result = s03BridgeResult.s03Result;

  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-2') {
    return failClosed(['agent2_event_lineage_mismatch'], s03BridgeResult);
  }
  if (!isObject(contextPackage) || Object.keys(contextPackage).length === 0) {
    return failClosed(['missing_context_package'], s03BridgeResult);
  }
  if (!isObject(s03Result) || s03Result.event_id !== event.event_id) {
    return failClosed(['s03_event_lineage_mismatch'], s03BridgeResult);
  }
  if (s03Result.next_action !== 'continue_to_decision_item_builder') {
    return failClosed(['s03_not_verified_for_builder'], s03BridgeResult);
  }
  if ((s03Result.scope?.product_id ?? null) !== (event.product_id ?? null)) {
    return failClosed(['s03_product_lineage_mismatch'], s03BridgeResult);
  }

  const builderResult = runDecisionItemBuilder({
    scope: {
      scope_type: event.scope_type,
      scope_id: event.scope_id ?? event.product_id ?? null,
      product_id: event.product_id ?? null,
      asin: event.asin ?? null,
    },
    source_event_refs: [event.event_id],
    context_package: contextPackage,
    context_refs: Array.isArray(s03BridgeResult.s02BridgeResult?.s02Result?.context_refs)
      ? s03BridgeResult.s02BridgeResult.s02Result.context_refs
      : [],
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
      status: builderResult.next_action === 'request_more_context' ? 'needs_information' : 'blocked',
      nextAction: builderResult.next_action === 'request_more_context' ? 'request_more_context' : 'hold_for_review',
      reasons: builderResult.builder_notes ?? ['builder_not_ready_for_S04'],
      runtimeVersion: A2_A1_DECISION_ITEM_RUNTIME_VERSION,
      builderRuntimeVersion: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
      s03BridgeResult,
      builderResult,
      canonicalEvent: event,
      contextPackage,
      decisionItems: [],
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
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
    runtimeVersion: A2_A1_DECISION_ITEM_RUNTIME_VERSION,
    builderRuntimeVersion: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
    s03BridgeResult,
    builderResult,
    canonicalEvent: event,
    contextPackage,
    decisionItems: builderResult.decision_items,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
