import { runAgent6ToS04 } from './a6-a1-s04-runtime.js';
import {
  buildS04PriorityCandidate,
  S04_PRIORITY_CONTRACT_VERSION,
} from './s04-priority.js';
import {
  rankS04PriorityCandidates,
  S04_PRIORITY_POLICY_VERSION,
} from './s04-priority-policy.js';

export const A6_A1_S04_PRIORITY_RUNTIME_VERSION = 'A6-A1-S04-priority-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'approvalGranted',
  'verifiedApprovalRecords',
  'taskAuthorized',
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'productionWriteAuthorized',
  'stateTransitionAuthorized',
  'finalDecision',
  'task',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons, s04BridgeResult = null, priorityCandidate = null, priorityResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A6_A1_S04_PRIORITY_RUNTIME_VERSION,
    priorityContractVersion: S04_PRIORITY_CONTRACT_VERSION,
    priorityPolicyVersion: S04_PRIORITY_POLICY_VERSION,
    s04BridgeResult,
    priorityCandidate,
    priorityResult,
    canonicalEvent: null,
    decisionItem: null,
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}

/**
 * Agent-6 read-only bridge from verified S04 ingress through Priority ranking.
 * Stops before Decision Formation. No TaskDraft, approval, permission, dispatch,
 * persistence mutation, Amazon mutation, or other production write occurs.
 */
export async function runAgent6ToS04Priority(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const s04BridgeResult = await runAgent6ToS04(input, options);
  if (
    s04BridgeResult.status !== 'ready_for_S04_decision_logic' ||
    s04BridgeResult.nextAction !== 'continue_to_S04_decision_logic'
  ) {
    return {
      ...failClosed(s04BridgeResult.reasons ?? ['agent6_s04_not_ready'], s04BridgeResult),
      status: s04BridgeResult.status,
      nextAction: s04BridgeResult.nextAction,
      canonicalEvent: s04BridgeResult.canonicalEvent ?? null,
      decisionItem: s04BridgeResult.decisionItem ?? null,
    };
  }

  const event = s04BridgeResult.canonicalEvent;
  const decisionItem = s04BridgeResult.decisionItem;
  const s04Result = s04BridgeResult.s04Result;

  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-6') {
    return failClosed(['agent6_event_lineage_mismatch'], s04BridgeResult);
  }
  if (event.event_type !== 'MARGIN_COMPRESSION') {
    return failClosed(['agent6_event_type_not_allowed_for_priority'], s04BridgeResult);
  }
  if (!isObject(decisionItem) || !isObject(s04Result)) {
    return failClosed(['missing_verified_s04_objects'], s04BridgeResult);
  }
  if (s04Result.decisionItemId !== decisionItem.decision_item_id) {
    return failClosed(['s04_decision_item_lineage_mismatch'], s04BridgeResult);
  }
  if (s04Result.eventId !== event.event_id || !decisionItem.source_event_refs?.includes(event.event_id)) {
    return failClosed(['s04_event_lineage_mismatch'], s04BridgeResult);
  }

  const expectedProductId = input?.scope?.product_id ?? null;
  const expectedScopeId = input?.scope?.scope_id ?? null;
  if (!expectedProductId || event.product_id !== expectedProductId || event.scope_type !== 'product' || event.scope_id !== expectedScopeId) {
    return failClosed(['agent6_product_scope_lineage_mismatch'], s04BridgeResult);
  }
  if (event.metrics?.product_id !== expectedProductId) {
    return failClosed(['agent6_financial_product_metric_lineage_mismatch'], s04BridgeResult);
  }
  if (
    event.metrics?.baseline_window_id !== input?.baseline_window?.window_id ||
    event.metrics?.current_window_id !== input?.current_window?.window_id
  ) {
    return failClosed(['agent6_financial_window_lineage_mismatch'], s04BridgeResult);
  }
  if (
    event.metrics?.cost_model_version !== input?.current_window?.cost_model_version ||
    event.metrics?.currency !== input?.current_window?.currency
  ) {
    return failClosed(['agent6_financial_basis_lineage_mismatch'], s04BridgeResult);
  }

  const priorityCandidate = buildS04PriorityCandidate(s04Result);
  if (
    priorityCandidate.status !== 'candidate_ready' ||
    priorityCandidate.rankingEligible !== true ||
    priorityCandidate.nextAction !== 'continue_to_priority_policy'
  ) {
    return failClosed(
      priorityCandidate.reasons?.length ? priorityCandidate.reasons : ['priority_candidate_not_ready'],
      s04BridgeResult,
      priorityCandidate,
    );
  }
  if (priorityCandidate.decisionItemId !== decisionItem.decision_item_id || priorityCandidate.eventId !== event.event_id) {
    return failClosed(['priority_lineage_mismatch'], s04BridgeResult, priorityCandidate);
  }

  const priorityResult = rankS04PriorityCandidates([priorityCandidate]);
  if (
    priorityResult.status !== 'ranking_ready' ||
    priorityResult.rankingEligible !== true ||
    priorityResult.nextAction !== 'continue_to_decision_formation' ||
    !Array.isArray(priorityResult.rankedDecisionItems) ||
    priorityResult.rankedDecisionItems.length !== 1
  ) {
    return failClosed(
      priorityResult.reasons?.length ? priorityResult.reasons : ['priority_policy_not_ready'],
      s04BridgeResult,
      priorityCandidate,
      priorityResult,
    );
  }

  const rankedItem = priorityResult.rankedDecisionItems[0];
  if (
    rankedItem.rank !== 1 ||
    rankedItem.decisionItemId !== decisionItem.decision_item_id ||
    rankedItem.eventId !== event.event_id
  ) {
    return failClosed(['ranked_decision_item_lineage_mismatch'], s04BridgeResult, priorityCandidate, priorityResult);
  }

  return {
    status: 'priority_ready',
    nextAction: 'continue_to_decision_formation',
    reasons: [],
    runtimeVersion: A6_A1_S04_PRIORITY_RUNTIME_VERSION,
    priorityContractVersion: S04_PRIORITY_CONTRACT_VERSION,
    priorityPolicyVersion: S04_PRIORITY_POLICY_VERSION,
    s04BridgeResult,
    priorityCandidate,
    priorityResult,
    canonicalEvent: event,
    decisionItem,
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}
