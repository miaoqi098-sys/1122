import { runAgent2ToS04ApprovalGate } from './a2-a1-s04-approval-gate-runtime.js';
import {
  createS04PermissionDecisions,
  S04_PERMISSION_DECISION_VERSION,
} from './s04-permission-decision.js';

export const A2_A1_S04_PERMISSION_BOUNDARY_RUNTIME_VERSION =
  'A2-A1-S04-permission-boundary-runtime-v1.0.0';

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
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons, approvalGateRuntimeResult = null, permissionDecisionResult = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A2_A1_S04_PERMISSION_BOUNDARY_RUNTIME_VERSION,
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
  };
}

/**
 * Agent-2 read-only bridge from Approval Gate intake to the Permission Decision boundary.
 *
 * No trusted human-approval adapter is wired into this runtime step. Therefore this
 * bridge deliberately supplies no approval records and requires the existing S04
 * permission-decision contract to fail closed. It proves that Agent-2 cannot cross
 * the permission boundary by supplying approval/permission state itself.
 */
export async function runAgent2ToS04PermissionBoundary(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const approvalGateRuntimeResult = await runAgent2ToS04ApprovalGate(input, options);
  if (
    approvalGateRuntimeResult.status !== 'approval_pending' ||
    approvalGateRuntimeResult.nextAction !== 'await_human_approval'
  ) {
    return {
      status: approvalGateRuntimeResult.status,
      nextAction: approvalGateRuntimeResult.nextAction,
      reasons: approvalGateRuntimeResult.reasons ?? [],
      runtimeVersion: A2_A1_S04_PERMISSION_BOUNDARY_RUNTIME_VERSION,
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
    };
  }

  if (
    approvalGateRuntimeResult.readOnly !== true ||
    approvalGateRuntimeResult.approvalGranted !== false ||
    approvalGateRuntimeResult.permissionGranted !== false ||
    approvalGateRuntimeResult.taskAuthorized !== false ||
    approvalGateRuntimeResult.executionAuthorized !== false ||
    approvalGateRuntimeResult.dispatchAuthorized !== false
  ) {
    return failClosed(['approval_gate_runtime_privilege_mismatch'], approvalGateRuntimeResult);
  }

  const approvalRequest = approvalGateRuntimeResult.approvalRequest;
  const approvalGateResult = approvalGateRuntimeResult.approvalGateResult;
  if (!isObject(approvalRequest) || !isObject(approvalGateResult)) {
    return failClosed(['missing_verified_approval_gate_objects'], approvalGateRuntimeResult);
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

  // Intentionally empty: only a future trusted human-approval adapter may provide
  // verified approval records. Caller-provided records are forbidden above.
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
    runtimeVersion: A2_A1_S04_PERMISSION_BOUNDARY_RUNTIME_VERSION,
    permissionDecisionContractVersion: S04_PERMISSION_DECISION_VERSION,
    approvalGateRuntimeResult,
    permissionDecisionResult,
    canonicalEvent: approvalGateRuntimeResult.canonicalEvent,
    decisionItem: approvalGateRuntimeResult.decisionItem,
    decisionCandidate: approvalGateRuntimeResult.decisionCandidate,
    taskDraft: approvalGateRuntimeResult.taskDraft,
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
  };
}
