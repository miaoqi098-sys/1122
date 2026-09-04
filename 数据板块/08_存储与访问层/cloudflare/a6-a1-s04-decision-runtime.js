import { runAgent6ToS04Priority } from './a6-a1-s04-priority-runtime.js';
import {
  formS04DecisionCandidates,
  S04_DECISION_FORMATION_VERSION,
} from './s04-decision-formation.js';

export const A6_A1_S04_DECISION_RUNTIME_VERSION = 'A6-A1-S04-decision-runtime-v1.0.0';

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

function failClosed(reasons, priorityBridgeResult = null, formationResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A6_A1_S04_DECISION_RUNTIME_VERSION,
    decisionFormationVersion: S04_DECISION_FORMATION_VERSION,
    priorityBridgeResult,
    formationResult,
    canonicalEvent: null,
    decisionItem: null,
    priorityCandidate: null,
    priorityResult: null,
    decisionCandidate: null,
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
 * Agent-6 read-only bridge from verified Priority output into Decision Formation.
 * Stops at a non-executable decision candidate. It does not generate TaskDrafts,
 * grant approval/permission, dispatch work, mutate persistence, or perform Amazon writes.
 */
export async function runAgent6ToS04DecisionFormation(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const priorityBridgeResult = await runAgent6ToS04Priority(input, options);
  if (
    priorityBridgeResult.status !== 'priority_ready' ||
    priorityBridgeResult.nextAction !== 'continue_to_decision_formation'
  ) {
    return {
      ...failClosed(priorityBridgeResult.reasons ?? ['agent6_priority_not_ready'], priorityBridgeResult),
      status: priorityBridgeResult.status,
      nextAction: priorityBridgeResult.nextAction,
      canonicalEvent: priorityBridgeResult.canonicalEvent ?? null,
      decisionItem: priorityBridgeResult.decisionItem ?? null,
      priorityCandidate: priorityBridgeResult.priorityCandidate ?? null,
      priorityResult: priorityBridgeResult.priorityResult ?? null,
    };
  }

  const event = priorityBridgeResult.canonicalEvent;
  const decisionItem = priorityBridgeResult.decisionItem;
  const priorityCandidate = priorityBridgeResult.priorityCandidate;
  const priorityResult = priorityBridgeResult.priorityResult;

  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-6') {
    return failClosed(['agent6_event_lineage_mismatch'], priorityBridgeResult);
  }
  if (event.event_type !== 'MARGIN_COMPRESSION') {
    return failClosed(['agent6_event_type_not_allowed_for_decision_formation'], priorityBridgeResult);
  }
  if (!isObject(decisionItem) || !isObject(priorityCandidate) || !isObject(priorityResult)) {
    return failClosed(['missing_verified_priority_objects'], priorityBridgeResult);
  }

  const expectedProductId = input?.scope?.product_id ?? null;
  const expectedScopeId = input?.scope?.scope_id ?? null;
  if (
    !expectedProductId ||
    event.product_id !== expectedProductId ||
    event.scope_type !== 'product' ||
    event.scope_id !== expectedScopeId
  ) {
    return failClosed(['agent6_product_scope_lineage_mismatch'], priorityBridgeResult);
  }
  if (event.metrics?.product_id !== expectedProductId) {
    return failClosed(['agent6_financial_product_metric_lineage_mismatch'], priorityBridgeResult);
  }
  if (
    event.metrics?.baseline_window_id !== input?.baseline_window?.window_id ||
    event.metrics?.current_window_id !== input?.current_window?.window_id
  ) {
    return failClosed(['agent6_financial_window_lineage_mismatch'], priorityBridgeResult);
  }
  if (
    event.metrics?.cost_model_version !== input?.current_window?.cost_model_version ||
    event.metrics?.currency !== input?.current_window?.currency
  ) {
    return failClosed(['agent6_financial_basis_lineage_mismatch'], priorityBridgeResult);
  }
  if (
    priorityCandidate.decisionItemId !== decisionItem.decision_item_id ||
    priorityCandidate.eventId !== event.event_id ||
    !Array.isArray(priorityResult.rankedDecisionItems) ||
    priorityResult.rankedDecisionItems.length !== 1
  ) {
    return failClosed(['agent6_priority_lineage_mismatch'], priorityBridgeResult);
  }

  const rankedItem = priorityResult.rankedDecisionItems[0];
  if (
    rankedItem.rank !== 1 ||
    rankedItem.decisionItemId !== decisionItem.decision_item_id ||
    rankedItem.eventId !== event.event_id
  ) {
    return failClosed(['agent6_ranked_item_lineage_mismatch'], priorityBridgeResult);
  }

  const formationResult = formS04DecisionCandidates(priorityResult);
  if (
    formationResult.status !== 'formation_ready' ||
    formationResult.formationEligible !== true ||
    formationResult.nextAction !== 'continue_to_task_draft_generation' ||
    !Array.isArray(formationResult.decisionCandidates) ||
    formationResult.decisionCandidates.length !== 1
  ) {
    return failClosed(
      formationResult.reasons?.length ? formationResult.reasons : ['decision_formation_not_ready'],
      priorityBridgeResult,
      formationResult,
    );
  }

  const decisionCandidate = formationResult.decisionCandidates[0];
  if (
    decisionCandidate.decisionItemId !== decisionItem.decision_item_id ||
    decisionCandidate.eventId !== event.event_id ||
    decisionCandidate.priorityRank !== 1 ||
    decisionCandidate.decisionState !== 'candidate' ||
    decisionCandidate.readOnly !== true ||
    decisionCandidate.executionAuthorized !== false ||
    decisionCandidate.taskGenerationMode !== 'draft_only'
  ) {
    return failClosed(['decision_candidate_contract_mismatch'], priorityBridgeResult, formationResult);
  }

  return {
    status: 'decision_candidate_ready',
    nextAction: 'continue_to_task_draft_generation',
    reasons: [],
    runtimeVersion: A6_A1_S04_DECISION_RUNTIME_VERSION,
    decisionFormationVersion: S04_DECISION_FORMATION_VERSION,
    priorityBridgeResult,
    formationResult,
    canonicalEvent: event,
    decisionItem,
    priorityCandidate,
    priorityResult,
    decisionCandidate,
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}
