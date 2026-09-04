import { runAgent6ToS04DecisionFormation } from './a6-a1-s04-decision-runtime.js';
import { generateS04TaskDrafts, S04_TASK_DRAFT_VERSION } from './s04-task-draft.js';

export const A6_A1_S04_TASK_DRAFT_RUNTIME_VERSION = 'A6-A1-S04-task-draft-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'productionWriteAuthorized',
  'stateTransitionAuthorized',
  'taskAuthorized',
  'approvalGranted',
  'verifiedApprovalRecords',
  'finalDecision',
  'task',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons, decisionBridgeResult = null, taskDraftResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A6_A1_S04_TASK_DRAFT_RUNTIME_VERSION,
    taskDraftVersion: S04_TASK_DRAFT_VERSION,
    decisionBridgeResult,
    taskDraftResult,
    canonicalEvent: null,
    decisionItem: null,
    decisionCandidate: null,
    taskDraft: null,
    readOnly: true,
    draftOnly: true,
    approvalRequired: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}

/**
 * Agent-6 read-only bridge from Decision Formation into draft-only TaskDraft generation.
 * Stops before Approval Gate. It performs no persistence mutation, dispatch, approval,
 * permission grant, execution, external action, or Amazon production write.
 */
export async function runAgent6ToS04TaskDraft(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const decisionBridgeResult = await runAgent6ToS04DecisionFormation(input, options);
  if (
    decisionBridgeResult.status !== 'decision_candidate_ready' ||
    decisionBridgeResult.nextAction !== 'continue_to_task_draft_generation'
  ) {
    return {
      ...failClosed(decisionBridgeResult.reasons ?? ['agent6_decision_candidate_not_ready'], decisionBridgeResult),
      status: decisionBridgeResult.status,
      nextAction: decisionBridgeResult.nextAction,
      canonicalEvent: decisionBridgeResult.canonicalEvent ?? null,
      decisionItem: decisionBridgeResult.decisionItem ?? null,
      decisionCandidate: decisionBridgeResult.decisionCandidate ?? null,
    };
  }

  const event = decisionBridgeResult.canonicalEvent;
  const decisionItem = decisionBridgeResult.decisionItem;
  const decisionCandidate = decisionBridgeResult.decisionCandidate;
  const formationResult = decisionBridgeResult.formationResult;

  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-6') {
    return failClosed(['agent6_event_lineage_mismatch'], decisionBridgeResult);
  }
  if (event.event_type !== 'MARGIN_COMPRESSION') {
    return failClosed(['agent6_event_type_not_allowed_for_task_draft'], decisionBridgeResult);
  }
  if (!isObject(decisionItem) || !isObject(decisionCandidate) || !isObject(formationResult)) {
    return failClosed(['missing_verified_decision_objects'], decisionBridgeResult);
  }

  const expectedProductId = input?.scope?.product_id ?? null;
  const expectedScopeId = input?.scope?.scope_id ?? null;
  if (
    !expectedProductId ||
    event.product_id !== expectedProductId ||
    event.scope_type !== 'product' ||
    event.scope_id !== expectedScopeId ||
    event.metrics?.product_id !== expectedProductId
  ) {
    return failClosed(['agent6_product_scope_lineage_mismatch'], decisionBridgeResult);
  }
  if (
    event.metrics?.baseline_window_id !== input?.baseline_window?.window_id ||
    event.metrics?.current_window_id !== input?.current_window?.window_id
  ) {
    return failClosed(['agent6_financial_window_lineage_mismatch'], decisionBridgeResult);
  }
  if (
    event.metrics?.cost_model_version !== input?.current_window?.cost_model_version ||
    event.metrics?.currency !== input?.current_window?.currency
  ) {
    return failClosed(['agent6_financial_basis_lineage_mismatch'], decisionBridgeResult);
  }
  if (
    decisionCandidate.decisionItemId !== decisionItem.decision_item_id ||
    decisionCandidate.eventId !== event.event_id ||
    decisionCandidate.decisionState !== 'candidate' ||
    decisionCandidate.readOnly !== true ||
    decisionCandidate.executionAuthorized !== false ||
    decisionCandidate.taskGenerationMode !== 'draft_only'
  ) {
    return failClosed(['decision_candidate_contract_mismatch'], decisionBridgeResult);
  }

  const taskDraftResult = generateS04TaskDrafts(formationResult);
  if (
    taskDraftResult.status !== 'task_drafts_ready' ||
    taskDraftResult.taskDraftEligible !== true ||
    taskDraftResult.nextAction !== 'continue_to_approval_gate' ||
    !Array.isArray(taskDraftResult.taskDrafts) ||
    taskDraftResult.taskDrafts.length !== 1
  ) {
    return failClosed(
      taskDraftResult.reasons?.length ? taskDraftResult.reasons : ['task_draft_generation_not_ready'],
      decisionBridgeResult,
      taskDraftResult,
    );
  }

  const taskDraft = taskDraftResult.taskDrafts[0];
  if (
    taskDraft.decisionCandidateId !== decisionCandidate.decisionCandidateId ||
    taskDraft.decisionItemId !== decisionItem.decision_item_id ||
    taskDraft.eventId !== event.event_id ||
    taskDraft.priorityRank !== 1 ||
    taskDraft.taskState !== 'draft' ||
    taskDraft.draftOnly !== true ||
    taskDraft.readOnly !== true ||
    taskDraft.executionAuthorized !== false ||
    taskDraft.approvalRequired !== true ||
    taskDraft.dispatchAuthorized !== false
  ) {
    return failClosed(['task_draft_contract_mismatch'], decisionBridgeResult, taskDraftResult);
  }

  return {
    status: 'task_draft_ready',
    nextAction: 'stop_before_approval_gate',
    reasons: [],
    runtimeVersion: A6_A1_S04_TASK_DRAFT_RUNTIME_VERSION,
    taskDraftVersion: S04_TASK_DRAFT_VERSION,
    decisionBridgeResult,
    taskDraftResult,
    canonicalEvent: event,
    decisionItem,
    decisionCandidate,
    taskDraft,
    readOnly: true,
    draftOnly: true,
    approvalRequired: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}
