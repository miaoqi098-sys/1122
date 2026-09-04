import { runAgent4ToS04TaskDraft } from './a4-a1-s04-task-draft-runtime.js';
import { createS04ApprovalRequests, S04_APPROVAL_GATE_VERSION } from './s04-approval-gate.js';

export const A4_A1_S04_APPROVAL_GATE_RUNTIME_VERSION = 'A4-A1-S04-approval-gate-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'approvalGranted','approved','approvedBy','approvalId','verifiedApprovalRecords',
  'permissionGranted','taskAuthorized','executionAuthorized','dispatchAuthorized',
  'productionWriteAuthorized','stateTransitionAuthorized','finalDecision','task',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons, taskDraftRuntimeResult = null, approvalGateResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A4_A1_S04_APPROVAL_GATE_RUNTIME_VERSION,
    approvalGateContractVersion: S04_APPROVAL_GATE_VERSION,
    taskDraftRuntimeResult,
    approvalGateResult,
    canonicalEvent: null,
    decisionItem: null,
    decisionCandidate: null,
    taskDraft: null,
    approvalRequest: null,
    readOnly: true,
    approvalRequired: true,
    humanApprovalRequired: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}

/**
 * Agent-4 read-only bridge from verified TaskDraft into S04 Approval Gate intake.
 * Creates exactly one pending human-approval request and stops before permission.
 * It never approves, grants permission, dispatches, executes, writes DB state,
 * mutates advertising state, or performs any Amazon production write.
 */
export async function runAgent4ToS04ApprovalGate(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const taskDraftRuntimeResult = await runAgent4ToS04TaskDraft(input, options);
  if (
    taskDraftRuntimeResult.status !== 'task_draft_ready' ||
    taskDraftRuntimeResult.nextAction !== 'stop_before_approval_gate'
  ) {
    return {
      status: taskDraftRuntimeResult.status,
      nextAction: taskDraftRuntimeResult.nextAction,
      reasons: taskDraftRuntimeResult.reasons ?? [],
      runtimeVersion: A4_A1_S04_APPROVAL_GATE_RUNTIME_VERSION,
      approvalGateContractVersion: S04_APPROVAL_GATE_VERSION,
      taskDraftRuntimeResult,
      approvalGateResult: null,
      canonicalEvent: taskDraftRuntimeResult.canonicalEvent ?? null,
      decisionItem: taskDraftRuntimeResult.decisionItem ?? null,
      decisionCandidate: taskDraftRuntimeResult.decisionCandidate ?? null,
      taskDraft: taskDraftRuntimeResult.taskDraft ?? null,
      approvalRequest: null,
      readOnly: true,
      approvalRequired: true,
      humanApprovalRequired: true,
      approvalGranted: false,
      permissionGranted: false,
      taskAuthorized: false,
      executionAuthorized: false,
      dispatchAuthorized: false,
      productionWriteAuthorized: false,
    };
  }

  if (
    taskDraftRuntimeResult.readOnly !== true ||
    taskDraftRuntimeResult.approvalGranted !== false ||
    taskDraftRuntimeResult.permissionGranted !== false ||
    taskDraftRuntimeResult.taskAuthorized !== false ||
    taskDraftRuntimeResult.executionAuthorized !== false ||
    taskDraftRuntimeResult.dispatchAuthorized !== false ||
    taskDraftRuntimeResult.productionWriteAuthorized !== false
  ) {
    return failClosed(['task_draft_runtime_privilege_mismatch'], taskDraftRuntimeResult);
  }

  const event = taskDraftRuntimeResult.canonicalEvent;
  const decisionItem = taskDraftRuntimeResult.decisionItem;
  const decisionCandidate = taskDraftRuntimeResult.decisionCandidate;
  const taskDraft = taskDraftRuntimeResult.taskDraft;
  const taskDraftResult = taskDraftRuntimeResult.taskDraftResult;

  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-4') {
    return failClosed(['agent4_event_lineage_mismatch'], taskDraftRuntimeResult);
  }
  if (event.event_type !== 'advertising_conversion_breakdown') {
    return failClosed(['agent4_event_type_not_allowed_for_approval_gate'], taskDraftRuntimeResult);
  }

  const expectedProductId = input?.scope?.product_id ?? null;
  const expectedScopeId = input?.scope?.scope_id ?? null;
  if (
    !expectedProductId ||
    event.product_id !== expectedProductId ||
    event.scope_type !== 'product' ||
    event.scope_id !== expectedScopeId
  ) {
    return failClosed(['agent4_product_scope_lineage_mismatch'], taskDraftRuntimeResult);
  }
  if (
    !event.metrics?.entity_type ||
    !event.metrics?.entity_id ||
    event.metrics.entity_type !== input?.entity?.entity_type ||
    event.metrics.entity_id !== input?.entity?.entity_id
  ) {
    return failClosed(['agent4_advertising_entity_lineage_mismatch'], taskDraftRuntimeResult);
  }
  if (
    event.metrics?.baseline_window_id !== input?.baseline_window?.window_id ||
    event.metrics?.current_window_id !== input?.current_window?.window_id
  ) {
    return failClosed(['agent4_advertising_window_lineage_mismatch'], taskDraftRuntimeResult);
  }
  if (!isObject(decisionItem) || !isObject(decisionCandidate) || !isObject(taskDraft) || !isObject(taskDraftResult)) {
    return failClosed(['missing_verified_task_draft_objects'], taskDraftRuntimeResult);
  }
  if (
    taskDraft.decisionCandidateId !== decisionCandidate.decisionCandidateId ||
    taskDraft.decisionItemId !== decisionItem.decision_item_id ||
    taskDraft.eventId !== event.event_id
  ) {
    return failClosed(['task_draft_lineage_mismatch'], taskDraftRuntimeResult);
  }

  const approvalGateResult = createS04ApprovalRequests(taskDraftResult);
  if (
    approvalGateResult.status !== 'approval_pending' ||
    approvalGateResult.approvalGateEligible !== true ||
    approvalGateResult.nextAction !== 'await_human_approval'
  ) {
    return failClosed(
      approvalGateResult.reasons?.length ? approvalGateResult.reasons : ['approval_gate_not_ready'],
      taskDraftRuntimeResult,
      approvalGateResult,
    );
  }
  if (!Array.isArray(approvalGateResult.approvalRequests) || approvalGateResult.approvalRequests.length !== 1) {
    return failClosed(['unexpected_approval_request_count'], taskDraftRuntimeResult, approvalGateResult);
  }

  const approvalRequest = approvalGateResult.approvalRequests[0];
  if (
    approvalRequest.taskDraftId !== taskDraft.taskDraftId ||
    approvalRequest.decisionCandidateId !== decisionCandidate.decisionCandidateId ||
    approvalRequest.decisionItemId !== decisionItem.decision_item_id ||
    approvalRequest.eventId !== event.event_id ||
    approvalRequest.builderRunId !== taskDraft.builderRunId ||
    approvalRequest.conflictRunId !== taskDraft.conflictRunId
  ) {
    return failClosed(['approval_request_lineage_mismatch'], taskDraftRuntimeResult, approvalGateResult);
  }
  if (
    approvalRequest.approvalStatus !== 'pending' ||
    approvalRequest.approvalRequired !== true ||
    approvalRequest.humanApprovalRequired !== true ||
    approvalRequest.readOnly !== true ||
    approvalRequest.executionAuthorized !== false ||
    approvalRequest.dispatchAuthorized !== false ||
    approvalRequest.permissionGranted !== false
  ) {
    return failClosed(['approval_request_contract_mismatch'], taskDraftRuntimeResult, approvalGateResult);
  }

  return {
    status: 'approval_pending',
    nextAction: 'await_human_approval',
    reasons: [],
    runtimeVersion: A4_A1_S04_APPROVAL_GATE_RUNTIME_VERSION,
    approvalGateContractVersion: S04_APPROVAL_GATE_VERSION,
    taskDraftRuntimeResult,
    approvalGateResult,
    canonicalEvent: event,
    decisionItem,
    decisionCandidate,
    taskDraft,
    approvalRequest,
    readOnly: true,
    approvalRequired: true,
    humanApprovalRequired: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}
