import { runAgent3ToS02 } from './a3-a1-s02-runtime.js';
import {
  runS03,
  S03_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S03_冲突检测/执行程序/runtime.js';

export const A3_A1_S03_RUNTIME_VERSION = 'A3-A1-S03-runtime-v1.0.0';

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

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function failClosed(reasons, s02BridgeResult = null, s03Result = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A3_A1_S03_RUNTIME_VERSION,
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

function validateAgent3S03Lineage(input, s02BridgeResult) {
  const reasons = [];
  const event = s02BridgeResult?.canonicalEvent;
  const s02Result = s02BridgeResult?.s02Result;
  const contextPackage = s02BridgeResult?.contextPackage;

  if (!isObject(event)) return ['missing_agent3_canonical_event'];
  if (event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-3') {
    reasons.push('agent3_event_source_lineage_mismatch');
  }
  if (event.event_type !== 'competitor_price_shift') {
    reasons.push('agent3_event_type_not_allowed_for_s03');
  }

  const expectedProductId = input?.our_scope?.product_id ?? null;
  const expectedScopeId = input?.our_scope?.scope_id ?? null;
  if (!nonEmptyString(expectedProductId)
      || event.product_id !== expectedProductId
      || event.scope_type !== 'product'
      || event.scope_id !== expectedScopeId) {
    reasons.push('agent3_product_scope_lineage_mismatch');
  }

  const current = input?.current_snapshot;
  const baseline = input?.baseline_snapshot;
  const expectedCompetitorId = current?.competitor_entity_id ?? null;
  if (!nonEmptyString(expectedCompetitorId)
      || event.metrics?.competitor_entity_id !== expectedCompetitorId
      || event.metrics?.relationship_type !== 'direct_competitor'
      || event.metrics?.baseline_snapshot_id !== baseline?.snapshot_id
      || event.metrics?.current_snapshot_id !== current?.snapshot_id) {
    reasons.push('agent3_competitor_lineage_mismatch');
  }

  if (!isObject(contextPackage) || Object.keys(contextPackage).length === 0) {
    reasons.push('missing_s02_context_package');
  }
  if (!['ready', 'ready_with_gaps'].includes(s02Result?.status)) {
    reasons.push('s02_not_verified_for_s03');
  }
  if (s02Result?.scope?.scope_type !== event.scope_type
      || s02Result?.scope?.product_id !== event.product_id) {
    reasons.push('s02_event_scope_lineage_mismatch');
  }

  const intakeEventId = s02BridgeResult?.intakeResult?.canonicalEvent?.event_id ?? null;
  const s01EventId = s02BridgeResult?.intakeResult?.s01Result?.normalized_event?.event_id ?? null;
  if (event.event_id !== intakeEventId || event.event_id !== s01EventId) {
    reasons.push('agent3_event_identity_lineage_mismatch');
  }

  return reasons;
}

/**
 * Read-only Agent-3 -> A1 S03 bridge.
 *
 * The bridge always re-runs Agent-3 -> R16 -> S01 -> S02, verifies the
 * professional-agent, product/scope, competitor, event and context lineage,
 * and only then invokes the shared S03 conflict detector. It does not create a
 * DecisionItem, approve a task, dispatch work, or perform any production write.
 */
export function runAgent3ToS03(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  const s02BridgeResult = runAgent3ToS02(input, options);
  if (s02BridgeResult.status !== 'ready_for_S03') {
    return {
      status: s02BridgeResult.status,
      nextAction: s02BridgeResult.nextAction,
      reasons: s02BridgeResult.reasons ?? [],
      runtimeVersion: A3_A1_S03_RUNTIME_VERSION,
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

  const lineageReasons = validateAgent3S03Lineage(input, s02BridgeResult);
  if (lineageReasons.length) return failClosed(lineageReasons, s02BridgeResult);

  const event = s02BridgeResult.canonicalEvent;
  const contextPackage = s02BridgeResult.contextPackage;
  const s02Result = s02BridgeResult.s02Result;
  const contextRefs = Array.isArray(s02Result?.context_refs)
    ? s02Result.context_refs
    : Array.isArray(contextPackage?.context_refs)
      ? contextPackage.context_refs
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
  if (s03Result.scope?.scope_type !== event.scope_type
      || (s03Result.scope?.scope_id ?? null) !== (event.scope_id ?? event.product_id ?? null)) {
    return failClosed(['s03_scope_lineage_mismatch'], s02BridgeResult, s03Result);
  }
  if ((s03Result.scope?.product_id ?? null) !== (event.product_id ?? null)) {
    return failClosed(['s03_product_lineage_mismatch'], s02BridgeResult, s03Result);
  }
  if (!ALLOWED_S03_ROUTES.has(s03Result.next_action)) {
    return failClosed(['unknown_s03_route'], s02BridgeResult, s03Result);
  }

  const status = s03Result.next_action === 'continue_to_decision_item_builder'
    ? 'ready_for_decision_item_builder'
    : s03Result.status;

  return {
    status,
    nextAction: s03Result.next_action,
    reasons: s03Result.status === 'blocked'
      ? ['s03_blocked', ...(s03Result.unresolved_points ?? [])]
      : [],
    runtimeVersion: A3_A1_S03_RUNTIME_VERSION,
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
