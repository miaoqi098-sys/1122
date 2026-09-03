import { runAgent2ToS02 } from './a2-a1-s02-runtime.js';
import {
  runS03,
  S03_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S03_冲突检测/执行程序/runtime.js';

export const A2_A1_S03_RUNTIME_VERSION = 'A2-A1-S03-runtime-v1.0.0';

const ALLOWED_S03_ROUTES = new Set([
  'continue_to_decision_item_builder',
  'hold_for_review',
  'request_evidence',
  'send_to_S10',
  'request_agent_review',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons, s02BridgeResult = null, s03Result = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A2_A1_S03_RUNTIME_VERSION,
    s03RuntimeVersion: S03_RUNTIME_VERSION,
    s02BridgeResult,
    s03Result,
    canonicalEvent: null,
    contextPackage: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}

export function runAgent2ToS03(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  const s02BridgeResult = runAgent2ToS02(input, options);
  if (s02BridgeResult.status !== 'ready_for_S03') {
    return {
      status: s02BridgeResult.status,
      nextAction: s02BridgeResult.nextAction,
      reasons: s02BridgeResult.reasons ?? [],
      runtimeVersion: A2_A1_S03_RUNTIME_VERSION,
      s03RuntimeVersion: S03_RUNTIME_VERSION,
      s02BridgeResult,
      s03Result: null,
      canonicalEvent: null,
      contextPackage: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  if (s02BridgeResult.nextAction !== 'continue_to_S03') {
    return failClosed(['s02_bridge_route_not_allowed_for_s03'], s02BridgeResult);
  }

  const event = s02BridgeResult.canonicalEvent;
  const contextPackage = s02BridgeResult.contextPackage;
  const s02Result = s02BridgeResult.s02Result;

  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-2') {
    return failClosed(['agent2_event_lineage_mismatch'], s02BridgeResult);
  }
  if (!isObject(contextPackage) || Object.keys(contextPackage).length === 0) {
    return failClosed(['missing_s02_context_package'], s02BridgeResult);
  }
  if (!['ready', 'ready_with_gaps'].includes(s02Result?.status)) {
    return failClosed(['s02_not_verified_for_s03'], s02BridgeResult);
  }
  if (s02Result?.scope?.product_id !== event.product_id) {
    return failClosed(['s02_event_product_lineage_mismatch'], s02BridgeResult);
  }

  const contextRefs = Array.isArray(s02Result?.context_refs)
    ? s02Result.context_refs
    : Array.isArray(s02BridgeResult?.s02Result?.context_package?.context_refs)
      ? s02BridgeResult.s02Result.context_package.context_refs
      : [];

  const s03Result = runS03({
    event_id: event.event_id,
    scope: {
      scope_type: event.scope_type,
      scope_id: event.scope_id ?? event.product_id ?? null,
      product_id: event.product_id ?? null,
      asin: event.asin ?? null,
    },
    context_package: contextPackage,
    context_refs: contextRefs,
    normalized_elements: Array.isArray(options.normalizedElements) ? options.normalizedElements : undefined,
    current_time: options.currentTime ?? event.received_at ?? event.occurred_at,
  });

  if (!isObject(s03Result)) return failClosed(['missing_s03_result'], s02BridgeResult);
  if (s03Result.event_id !== event.event_id) {
    return failClosed(['s03_event_lineage_mismatch'], s02BridgeResult, s03Result);
  }
  if (s03Result.scope?.scope_type !== event.scope_type) {
    return failClosed(['s03_scope_type_lineage_mismatch'], s02BridgeResult, s03Result);
  }
  if ((s03Result.scope?.product_id ?? null) !== (event.product_id ?? null)) {
    return failClosed(['s03_product_lineage_mismatch'], s02BridgeResult, s03Result);
  }
  if (!ALLOWED_S03_ROUTES.has(s03Result.next_action)) {
    return failClosed(['unknown_s03_route'], s02BridgeResult, s03Result);
  }

  const nextActionMap = {
    continue_to_decision_item_builder: 'continue_to_decision_item_builder',
    hold_for_review: 'hold_for_review',
    request_evidence: 'request_evidence',
    send_to_S10: 'send_to_S10',
    request_agent_review: 'request_agent_review',
  };

  const status = s03Result.next_action === 'continue_to_decision_item_builder'
    ? 'ready_for_decision_item_builder'
    : s03Result.status;

  return {
    status,
    nextAction: nextActionMap[s03Result.next_action],
    reasons: s03Result.status === 'blocked'
      ? ['s03_blocked', ...(s03Result.unresolved_points ?? [])]
      : [],
    runtimeVersion: A2_A1_S03_RUNTIME_VERSION,
    s03RuntimeVersion: S03_RUNTIME_VERSION,
    s02BridgeResult,
    s03Result,
    canonicalEvent: event,
    contextPackage,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
