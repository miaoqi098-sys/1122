import { runAgent2ToS04TaskDraft } from './a2-a1-s04-task-draft-runtime.js';
import { createS04ApprovalRequests, S04_APPROVAL_GATE_VERSION } from './s04-approval-gate.js';

export const A2_A1_S04_APPROVAL_GATE_RUNTIME_VERSION = 'A2-A1-S04-approval-gate-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'approvalGranted',
  'approved',
  'approvedBy',
  'approvalId',
  'permissionGranted',
  'taskAuthorized',
  'executionAuthorized',
  'dispatchAuthorized',
  'productionWriteAuthorized',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons, taskDraftRuntimeResult = null, approvalGateResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A2_A1_S04_APPROVAL_GATE_RUNTIME_VERSION,
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
  };
}

/**
 * Agent-2 read-only bridge from TaskDraft into S04 Approval Gate intake.
 *
 * This step creates one pending approval request and stops. It cannot approve,
 * grant permissions, dispatch, execute, write to a database, or mutate Amazon/Ads.
 */
export async function runAgent2ToS04ApprovalGate(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const taskDraftRuntimeResult = await runAgent2ToS04TaskDraft(input, options);
  if (
    taskDraftRuntimeResult.status !== 'task_draft_ready' ||
    taskDraftRuntimeResult.nextAction !== 'stop_before_approval_gate'
  ) {
    return {
      status: taskDraftRuntimeResult.status,
      nextAction: taskDraftRuntimeResult.nextAction,
      reasons: taskDraftRuntimeResult.reasons ?? [],
      runtimeVersion: A2_A1_S04_APPROVAL_GATE_RUNTIME_VERSION,
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
    };
  }

  if (
    taskDraftRuntimeResult.readOnly !== true ||
    taskDraftRuntimeResult.approvalGranted !== false ||
    taskDraftRuntimeResult.taskAuthorized !== false ||
    taskDraftRuntimeResult.executionAuthorized !== false ||
    taskDraftRuntimeResult.dispatchAuthorized !== false
  ) {
    return failClosed(['task_draft_runtime_privilege_mismatch'], taskDraftRuntimeResult);
  }

  const event = taskDraftRuntimeResult.canonicalEvent;
  const decisionItem = taskDraftRuntimeResult.decisionItem;
  const decisionCandidate = taskDraftRuntimeResult.decisionCandidate;
  const taskDraft = taskDraftRuntimeResult.taskDraft;
  const taskDraftResult = taskDraftRuntimeResult.taskDraftResult;

  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-2') {
    return failClosed(['agent2_event_lineage_mismatch'], taskDraftRuntimeResult);
  }
  if (!isObject(decisionItem) || !isObject(decisionCandidate) || !isObject(taskDraft) || !isObject(taskDraftResult)) {
    return failClosed(['missing_verified_task_draft_objects'], taskDraftRuntimeResult);
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
    runtimeVersion: A2_A1_S04_APPROVAL_GATE_RUNTIME_VERSION,
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
  };
}
