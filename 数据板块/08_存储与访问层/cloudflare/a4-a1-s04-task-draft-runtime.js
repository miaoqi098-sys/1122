import { runAgent4ToS04DecisionFormation } from './a4-a1-s04-decision-runtime.js';
import { generateS04TaskDrafts, S04_TASK_DRAFT_VERSION } from './s04-task-draft.js';

export const A4_A1_S04_TASK_DRAFT_RUNTIME_VERSION = 'A4-A1-S04-task-draft-runtime-v1.0.0';

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

function failClosed(reasons, decisionResult = null, taskDraftResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A4_A1_S04_TASK_DRAFT_RUNTIME_VERSION,
    taskDraftContractVersion: S04_TASK_DRAFT_VERSION,
    decisionResult,
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
 * Agent-4 read-only bridge from verified S04 decision formation to TaskDraft generation.
 * Stops before approval. No DB write, approval grant, permission grant, dispatch,
 * advertising mutation, executor call, Amazon mutation, or other production write occurs.
 */
export async function runAgent4ToS04TaskDraft(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const decisionResult = await runAgent4ToS04DecisionFormation(input, options);
  if (
    decisionResult.status !== 'decision_candidate_ready' ||
    decisionResult.nextAction !== 'continue_to_task_draft_generation'
  ) {
    return {
      status: decisionResult.status,
      nextAction: decisionResult.nextAction,
      reasons: decisionResult.reasons ?? [],
      runtimeVersion: A4_A1_S04_TASK_DRAFT_RUNTIME_VERSION,
      taskDraftContractVersion: S04_TASK_DRAFT_VERSION,
      decisionResult,
      taskDraftResult: null,
      canonicalEvent: decisionResult.canonicalEvent ?? null,
      decisionItem: decisionResult.decisionItem ?? null,
      decisionCandidate: decisionResult.decisionCandidate ?? null,
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

  const event = decisionResult.canonicalEvent;
  const decisionItem = decisionResult.decisionItem;
  const decisionCandidate = decisionResult.decisionCandidate;
  const formationResult = decisionResult.formationResult;

  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-4') {
    return failClosed(['agent4_event_lineage_mismatch'], decisionResult);
  }
  if (event.event_type !== 'advertising_conversion_breakdown') {
    return failClosed(['agent4_event_type_not_allowed_for_task_draft'], decisionResult);
  }

  const expectedProductId = input?.scope?.product_id ?? null;
  const expectedScopeId = input?.scope?.scope_id ?? null;
  if (
    !expectedProductId ||
    event.product_id !== expectedProductId ||
    event.scope_type !== 'product' ||
    event.scope_id !== expectedScopeId
  ) {
    return failClosed(['agent4_product_scope_lineage_mismatch'], decisionResult);
  }
  if (
    !event.metrics?.entity_type ||
    !event.metrics?.entity_id ||
    event.metrics.entity_type !== input?.entity?.entity_type ||
    event.metrics.entity_id !== input?.entity?.entity_id
  ) {
    return failClosed(['agent4_advertising_entity_lineage_mismatch'], decisionResult);
  }
  if (
    event.metrics?.baseline_window_id !== input?.baseline_window?.window_id ||
    event.metrics?.current_window_id !== input?.current_window?.window_id
  ) {
    return failClosed(['agent4_advertising_window_lineage_mismatch'], decisionResult);
  }
  if (!isObject(decisionItem) || !isObject(decisionCandidate) || !isObject(formationResult)) {
    return failClosed(['missing_verified_decision_objects'], decisionResult);
  }
  if (
    decisionCandidate.decisionItemId !== decisionItem.decision_item_id ||
    decisionCandidate.eventId !== event.event_id ||
    !decisionItem.source_event_refs?.includes(event.event_id)
  ) {
    return failClosed(['decision_candidate_lineage_mismatch'], decisionResult);
  }
  if (
    decisionCandidate.readOnly !== true ||
    decisionCandidate.executionAuthorized !== false ||
    decisionCandidate.taskGenerationMode !== 'draft_only'
  ) {
    return failClosed(['decision_candidate_privilege_mismatch'], decisionResult);
  }

  const taskDraftResult = generateS04TaskDrafts(formationResult);
  if (
    taskDraftResult.status !== 'task_drafts_ready' ||
    taskDraftResult.taskDraftEligible !== true ||
    taskDraftResult.nextAction !== 'continue_to_approval_gate'
  ) {
    return failClosed(
      taskDraftResult.reasons?.length ? taskDraftResult.reasons : ['task_draft_not_ready'],
      decisionResult,
      taskDraftResult,
    );
  }
  if (!Array.isArray(taskDraftResult.taskDrafts) || taskDraftResult.taskDrafts.length !== 1) {
    return failClosed(['unexpected_task_draft_count'], decisionResult, taskDraftResult);
  }

  const taskDraft = taskDraftResult.taskDrafts[0];
  if (
    taskDraft.decisionCandidateId !== decisionCandidate.decisionCandidateId ||
    taskDraft.decisionItemId !== decisionItem.decision_item_id ||
    taskDraft.eventId !== event.event_id
  ) {
    return failClosed(['task_draft_lineage_mismatch'], decisionResult, taskDraftResult);
  }
  if (
    taskDraft.taskState !== 'draft' ||
    taskDraft.draftOnly !== true ||
    taskDraft.readOnly !== true ||
    taskDraft.executionAuthorized !== false ||
    taskDraft.approvalRequired !== true ||
    taskDraft.dispatchAuthorized !== false
  ) {
    return failClosed(['task_draft_contract_mismatch'], decisionResult, taskDraftResult);
  }

  return {
    status: 'task_draft_ready',
    nextAction: 'stop_before_approval_gate',
    reasons: [],
    runtimeVersion: A4_A1_S04_TASK_DRAFT_RUNTIME_VERSION,
    taskDraftContractVersion: S04_TASK_DRAFT_VERSION,
    decisionResult,
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
