import { runAgent6ToS04ApprovalGate } from './a6-a1-s04-approval-gate-runtime.js';
import {
  createS04PermissionDecisions,
  S04_PERMISSION_DECISION_VERSION,
} from './s04-permission-decision.js';

export const A6_A1_S04_PERMISSION_BOUNDARY_RUNTIME_VERSION =
  'A6-A1-S04-permission-boundary-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'approvalGranted',
  'approved',
  'approvedBy',
  'approvalId',
  'approvalRecord',
  'approvalRecords',
  'verifiedApprovalRecord',
  'verifiedApprovalRecords',
  'humanApprovalRecord',
  'permissionGranted',
  'taskAuthorized',
  'executionAuthorized',
  'dispatchAuthorized',
  'productionWriteAuthorized',
  'stateTransitionAuthorized',
  'finalDecision',
  'task',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons, approvalGateRuntimeResult = null, permissionDecisionResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A6_A1_S04_PERMISSION_BOUNDARY_RUNTIME_VERSION,
    permissionDecisionContractVersion: S04_PERMISSION_DECISION_VERSION,
    approvalGateRuntimeResult,
    permissionDecisionResult,
    canonicalEvent: null,
    decisionItem: null,
    decisionCandidate: null,
    taskDraft: null,
    approvalRequest: null,
    permissionDecision: null,
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
 * Agent-6 read-only bridge from Approval Gate intake to the Permission Decision boundary.
 * Caller-provided approval/permission state is rejected. The shared permission-decision
 * contract is invoked with zero verified human-approval records and must fail closed.
 */
export async function runAgent6ToS04PermissionBoundary(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const approvalGateRuntimeResult = await runAgent6ToS04ApprovalGate(input, options);
  if (
    approvalGateRuntimeResult.status !== 'approval_pending' ||
    approvalGateRuntimeResult.nextAction !== 'await_human_approval'
  ) {
    return {
      status: approvalGateRuntimeResult.status,
      nextAction: approvalGateRuntimeResult.nextAction,
      reasons: approvalGateRuntimeResult.reasons ?? [],
      runtimeVersion: A6_A1_S04_PERMISSION_BOUNDARY_RUNTIME_VERSION,
      permissionDecisionContractVersion: S04_PERMISSION_DECISION_VERSION,
      approvalGateRuntimeResult,
      permissionDecisionResult: null,
      canonicalEvent: approvalGateRuntimeResult.canonicalEvent ?? null,
      decisionItem: approvalGateRuntimeResult.decisionItem ?? null,
      decisionCandidate: approvalGateRuntimeResult.decisionCandidate ?? null,
      taskDraft: approvalGateRuntimeResult.taskDraft ?? null,
      approvalRequest: approvalGateRuntimeResult.approvalRequest ?? null,
      permissionDecision: null,
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
    approvalGateRuntimeResult.readOnly !== true ||
    approvalGateRuntimeResult.approvalGranted !== false ||
    approvalGateRuntimeResult.permissionGranted !== false ||
    approvalGateRuntimeResult.taskAuthorized !== false ||
    approvalGateRuntimeResult.executionAuthorized !== false ||
    approvalGateRuntimeResult.dispatchAuthorized !== false ||
    approvalGateRuntimeResult.productionWriteAuthorized !== false
  ) {
    return failClosed(['approval_gate_runtime_privilege_mismatch'], approvalGateRuntimeResult);
  }

  const event = approvalGateRuntimeResult.canonicalEvent;
  const approvalRequest = approvalGateRuntimeResult.approvalRequest;
  const approvalGateResult = approvalGateRuntimeResult.approvalGateResult;
  const taskDraft = approvalGateRuntimeResult.taskDraft;
  const decisionCandidate = approvalGateRuntimeResult.decisionCandidate;
  const decisionItem = approvalGateRuntimeResult.decisionItem;

  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-6') {
    return failClosed(['agent6_event_lineage_mismatch'], approvalGateRuntimeResult);
  }
  if (event.event_type !== 'MARGIN_COMPRESSION') {
    return failClosed(['agent6_event_type_not_allowed_for_permission_boundary'], approvalGateRuntimeResult);
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
    return failClosed(['agent6_product_scope_lineage_mismatch'], approvalGateRuntimeResult);
  }
  if (
    event.metrics?.baseline_window_id !== input?.baseline_window?.window_id ||
    event.metrics?.current_window_id !== input?.current_window?.window_id
  ) {
    return failClosed(['agent6_financial_window_lineage_mismatch'], approvalGateRuntimeResult);
  }
  if (
    event.metrics?.cost_model_version !== input?.current_window?.cost_model_version ||
    event.metrics?.currency !== input?.current_window?.currency
  ) {
    return failClosed(['agent6_financial_basis_lineage_mismatch'], approvalGateRuntimeResult);
  }

  if (
    !isObject(approvalRequest) ||
    !isObject(approvalGateResult) ||
    !isObject(taskDraft) ||
    !isObject(decisionCandidate) ||
    !isObject(decisionItem)
  ) {
    return failClosed(['missing_verified_approval_gate_objects'], approvalGateRuntimeResult);
  }

  if (
    approvalRequest.taskDraftId !== taskDraft.taskDraftId ||
    approvalRequest.decisionCandidateId !== decisionCandidate.decisionCandidateId ||
    approvalRequest.decisionItemId !== decisionItem.decision_item_id ||
    approvalRequest.eventId !== event.event_id
  ) {
    return failClosed(['approval_request_lineage_mismatch'], approvalGateRuntimeResult);
  }

  if (
    approvalRequest.approvalStatus !== 'pending' ||
    approvalRequest.approvalRequired !== true ||
    approvalRequest.humanApprovalRequired !== true ||
    approvalRequest.readOnly !== true ||
    approvalRequest.permissionGranted !== false ||
    approvalRequest.executionAuthorized !== false ||
    approvalRequest.dispatchAuthorized !== false
  ) {
    return failClosed(['approval_request_contract_mismatch'], approvalGateRuntimeResult);
  }

  const permissionDecisionResult = createS04PermissionDecisions(approvalGateResult, []);

  if (
    permissionDecisionResult.status !== 'blocked' ||
    permissionDecisionResult.permissionDecisionEligible !== false ||
    permissionDecisionResult.nextAction !== 'hold_for_review' ||
    !permissionDecisionResult.reasons?.includes('approval_record_count_mismatch') ||
    permissionDecisionResult.executionAuthorized !== false ||
    permissionDecisionResult.dispatchAuthorized !== false ||
    !Array.isArray(permissionDecisionResult.permissionDecisions) ||
    permissionDecisionResult.permissionDecisions.length !== 0
  ) {
    return failClosed(
      ['permission_boundary_fail_closed_contract_mismatch'],
      approvalGateRuntimeResult,
      permissionDecisionResult,
    );
  }

  return {
    status: 'approval_pending',
    nextAction: 'await_verified_human_approval',
    reasons: ['verified_human_approval_required'],
    runtimeVersion: A6_A1_S04_PERMISSION_BOUNDARY_RUNTIME_VERSION,
    permissionDecisionContractVersion: S04_PERMISSION_DECISION_VERSION,
    approvalGateRuntimeResult,
    permissionDecisionResult,
    canonicalEvent: event,
    decisionItem,
    decisionCandidate,
    taskDraft,
    approvalRequest,
    permissionDecision: null,
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
