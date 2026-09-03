import { runAgent3ToS04 } from './a3-a1-s04-runtime.js';
import {
  buildS04PriorityCandidate,
  S04_PRIORITY_CONTRACT_VERSION,
} from './s04-priority.js';
import {
  rankS04PriorityCandidates,
  S04_PRIORITY_POLICY_VERSION,
} from './s04-priority-policy.js';
import {
  formS04DecisionCandidates,
  S04_DECISION_FORMATION_VERSION,
} from './s04-decision-formation.js';

export const A3_A1_S04_DECISION_RUNTIME_VERSION = 'A3-A1-S04-decision-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'productionWriteAuthorized',
  'taskAuthorized',
  'approvalGranted',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons, s04BridgeResult = null, priorityCandidate = null, priorityResult = null, formationResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A3_A1_S04_DECISION_RUNTIME_VERSION,
    priorityContractVersion: S04_PRIORITY_CONTRACT_VERSION,
    priorityPolicyVersion: S04_PRIORITY_POLICY_VERSION,
    decisionFormationVersion: S04_DECISION_FORMATION_VERSION,
    s04BridgeResult,
    priorityCandidate,
    priorityResult,
    formationResult,
    canonicalEvent: null,
    decisionItem: null,
    decisionCandidate: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
    taskAuthorized: false,
  };
}

/**
 * Agent-3 read-only bridge through S04 priority and decision formation.
 * Stops at a non-executable decision candidate. No TaskDraft, approval,
 * permission, dispatch, D1 write, or Amazon/Ads production mutation occurs.
 */
export async function runAgent3ToS04DecisionFormation(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const s04BridgeResult = await runAgent3ToS04(input, options);
  if (
    s04BridgeResult.status !== 'ready_for_S04_decision_logic' ||
    s04BridgeResult.nextAction !== 'continue_to_S04_decision_logic'
  ) {
    return {
      status: s04BridgeResult.status,
      nextAction: s04BridgeResult.nextAction,
      reasons: s04BridgeResult.reasons ?? [],
      runtimeVersion: A3_A1_S04_DECISION_RUNTIME_VERSION,
      priorityContractVersion: S04_PRIORITY_CONTRACT_VERSION,
      priorityPolicyVersion: S04_PRIORITY_POLICY_VERSION,
      decisionFormationVersion: S04_DECISION_FORMATION_VERSION,
      s04BridgeResult,
      priorityCandidate: null,
      priorityResult: null,
      formationResult: null,
      canonicalEvent: s04BridgeResult.canonicalEvent ?? null,
      decisionItem: s04BridgeResult.decisionItem ?? null,
      decisionCandidate: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
      taskAuthorized: false,
    };
  }

  const event = s04BridgeResult.canonicalEvent;
  const decisionItem = s04BridgeResult.decisionItem;
  const s04Result = s04BridgeResult.s04Result;

  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-3') {
    return failClosed(['agent3_event_lineage_mismatch'], s04BridgeResult);
  }
  if (event.event_type !== 'competitor_price_shift') {
    return failClosed(['agent3_event_type_not_allowed_for_decision_formation'], s04BridgeResult);
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
  if (!event.product_id || event.product_id !== input?.our_scope?.product_id) {
    return failClosed(['agent3_product_lineage_mismatch'], s04BridgeResult);
  }
  if (
    !event.metrics?.competitor_entity_id ||
    event.metrics.competitor_entity_id !== input?.current_snapshot?.competitor_entity_id ||
    event.metrics.relationship_type !== 'direct_competitor'
  ) {
    return failClosed(['agent3_competitor_lineage_mismatch'], s04BridgeResult);
  }

  const priorityCandidate = buildS04PriorityCandidate(s04Result);
  if (
    priorityCandidate.status !== 'candidate_ready' ||
    priorityCandidate.rankingEligible !== true ||
    priorityCandidate.nextAction !== 'continue_to_priority_policy'
  ) {
    return failClosed(priorityCandidate.reasons?.length ? priorityCandidate.reasons : ['priority_candidate_not_ready'], s04BridgeResult, priorityCandidate);
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
    return failClosed(priorityResult.reasons?.length ? priorityResult.reasons : ['priority_policy_not_ready'], s04BridgeResult, priorityCandidate, priorityResult);
  }
  const rankedItem = priorityResult.rankedDecisionItems[0];
  if (rankedItem.rank !== 1 || rankedItem.decisionItemId !== decisionItem.decision_item_id) {
    return failClosed(['ranked_decision_item_lineage_mismatch'], s04BridgeResult, priorityCandidate, priorityResult);
  }

  const formationResult = formS04DecisionCandidates(priorityResult);
  if (
    formationResult.status !== 'formation_ready' ||
    formationResult.formationEligible !== true ||
    formationResult.nextAction !== 'continue_to_task_draft_generation' ||
    !Array.isArray(formationResult.decisionCandidates) ||
    formationResult.decisionCandidates.length !== 1
  ) {
    return failClosed(formationResult.reasons?.length ? formationResult.reasons : ['decision_formation_not_ready'], s04BridgeResult, priorityCandidate, priorityResult, formationResult);
  }

  const decisionCandidate = formationResult.decisionCandidates[0];
  if (
    decisionCandidate.decisionItemId !== decisionItem.decision_item_id ||
    decisionCandidate.eventId !== event.event_id ||
    decisionCandidate.decisionState !== 'candidate' ||
    decisionCandidate.readOnly !== true ||
    decisionCandidate.executionAuthorized !== false ||
    decisionCandidate.taskGenerationMode !== 'draft_only'
  ) {
    return failClosed(['decision_candidate_contract_mismatch'], s04BridgeResult, priorityCandidate, priorityResult, formationResult);
  }

  return {
    status: 'decision_candidate_ready',
    nextAction: 'continue_to_task_draft_generation',
    reasons: [],
    runtimeVersion: A3_A1_S04_DECISION_RUNTIME_VERSION,
    priorityContractVersion: S04_PRIORITY_CONTRACT_VERSION,
    priorityPolicyVersion: S04_PRIORITY_POLICY_VERSION,
    decisionFormationVersion: S04_DECISION_FORMATION_VERSION,
    s04BridgeResult,
    priorityCandidate,
    priorityResult,
    formationResult,
    canonicalEvent: event,
    decisionItem,
    decisionCandidate,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
    taskAuthorized: false,
  };
}
