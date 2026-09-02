import { S04_APPROVAL_GATE_VERSION } from './s04-approval-gate.js';

export const S04_PERMISSION_DECISION_VERSION = 'S04-permission-decision-v0.1.0';
export const S04_HUMAN_APPROVAL_VERIFICATION_VERSION = 'human-approval-verification-v1';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    permissionDecisionEligible: false,
    nextAction: 'hold_for_review',
    permissionDecisions: [],
    executionAuthorized: false,
    dispatchAuthorized: false,
    reasons: [reason],
    contractVersion: S04_PERMISSION_DECISION_VERSION,
  };
}

function validateApprovalRequest(request, expectedRank) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return { ok: false, reason: 'invalid_approval_request_shape' };
  }

  const approvalRequestId = text(request.approvalRequestId);
  const taskDraftId = text(request.taskDraftId);
  const decisionCandidateId = text(request.decisionCandidateId);
  const decisionItemId = text(request.decisionItemId);
  const eventId = text(request.eventId);
  const builderRunId = text(request.builderRunId);
  const conflictRunId = text(request.conflictRunId);
  const priorityRank = Number(request.priorityRank);

  if (!approvalRequestId || !taskDraftId || !decisionCandidateId || !decisionItemId) {
    return { ok: false, reason: 'missing_permission_identity' };
  }
  if (decisionCandidateId !== `DC:${decisionItemId}`) {
    return { ok: false, reason: 'permission_decision_candidate_identity_mismatch' };
  }
  if (taskDraftId !== `TD:${decisionCandidateId}`) {
    return { ok: false, reason: 'permission_task_draft_identity_mismatch' };
  }
  if (approvalRequestId !== `AR:${taskDraftId}`) {
    return { ok: false, reason: 'approval_request_identity_mismatch' };
  }
  if (!Number.isInteger(priorityRank) || priorityRank !== expectedRank) {
    return { ok: false, reason: 'invalid_permission_priority_rank' };
  }
  if (!eventId || !builderRunId || !conflictRunId) {
    return { ok: false, reason: 'missing_permission_lineage' };
  }

  if (request.approvalStatus !== 'pending') return { ok: false, reason: 'approval_request_not_pending' };
  if (request.approvalRequired !== true) return { ok: false, reason: 'approval_requirement_invalid' };
  if (request.humanApprovalRequired !== true) return { ok: false, reason: 'human_approval_requirement_invalid' };
  if (request.readOnly !== true) return { ok: false, reason: 'approval_request_not_read_only' };
  if (request.executionAuthorized !== false) return { ok: false, reason: 'approval_request_execution_flag_invalid' };
  if (request.dispatchAuthorized !== false) return { ok: false, reason: 'approval_request_dispatch_flag_invalid' };
  if (request.permissionGranted !== false) return { ok: false, reason: 'approval_request_permission_flag_invalid' };

  return {
    ok: true,
    value: {
      approvalRequestId,
      taskDraftId,
      decisionCandidateId,
      decisionItemId,
      priorityRank,
      eventId,
      builderRunId,
      conflictRunId,
    },
  };
}

function validateVerifiedRecord(record, request) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, reason: 'invalid_approval_record_shape' };
  }

  const approvalRecordId = text(record.approvalRecordId);
  const approvalRequestId = text(record.approvalRequestId);
  const taskDraftId = text(record.taskDraftId);
  const decisionItemId = text(record.decisionItemId);
  const reviewerId = text(record.reviewerId);
  const decision = text(record.decision);
  const decidedAt = text(record.decidedAt);
  const verificationSource = text(record.verificationSource);
  const verificationVersion = text(record.verificationVersion);

  if (!approvalRecordId || !approvalRequestId || !taskDraftId || !decisionItemId || !reviewerId || !decidedAt) {
    return { ok: false, reason: 'missing_verified_approval_fields' };
  }
  if (approvalRequestId !== request.approvalRequestId || taskDraftId !== request.taskDraftId || decisionItemId !== request.decisionItemId) {
    return { ok: false, reason: 'approval_record_binding_mismatch' };
  }
  if (approvalRecordId !== `AP:${approvalRequestId}`) {
    return { ok: false, reason: 'approval_record_identity_mismatch' };
  }
  if (decision !== 'approved' && decision !== 'rejected') {
    return { ok: false, reason: 'invalid_human_approval_decision' };
  }

  const timestamp = Date.parse(decidedAt);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: 'invalid_approval_decision_timestamp' };

  // Only records already authenticated by the dedicated human-approval adapter may enter.
  // This module validates that adapter contract; it never authenticates users itself.
  if (record.verificationStatus !== 'verified') {
    return { ok: false, reason: 'approval_record_not_verified' };
  }
  if (verificationSource !== 'trusted_human_approval_adapter') {
    return { ok: false, reason: 'untrusted_approval_verification_source' };
  }
  if (verificationVersion !== S04_HUMAN_APPROVAL_VERIFICATION_VERSION) {
    return { ok: false, reason: 'unsupported_approval_verification_version' };
  }

  if (record.executionAuthorized === true || record.dispatchAuthorized === true) {
    return { ok: false, reason: 'approval_record_authorization_smuggling_forbidden' };
  }

  return {
    ok: true,
    value: {
      approvalRecordId,
      reviewerId,
      decision,
      decidedAt: new Date(timestamp).toISOString(),
      verificationSource,
      verificationVersion,
    },
  };
}

/**
 * Read-only permission-decision boundary.
 *
 * It accepts only pending approval requests plus records that a separate trusted
 * human-approval adapter has already authenticated. It may mark permission as
 * granted for downstream eligibility, but it can never dispatch or execute work.
 * Any malformed, ambiguous, forged, duplicated, or execution-capable input fails
 * the whole batch closed.
 */
export function createS04PermissionDecisions(approvalGateResult, verifiedApprovalRecords) {
  if (
    approvalGateResult?.status !== 'approval_pending' ||
    approvalGateResult?.approvalGateEligible !== true ||
    approvalGateResult?.nextAction !== 'await_human_approval'
  ) {
    return blocked('approval_requests_not_released');
  }

  if (text(approvalGateResult?.contractVersion) !== S04_APPROVAL_GATE_VERSION) {
    return blocked('unsupported_approval_gate_version');
  }

  if (
    approvalGateResult?.executionAuthorized === true ||
    approvalGateResult?.dispatchAuthorized === true ||
    approvalGateResult?.permissionGranted === true
  ) {
    return blocked('approval_gate_authorization_smuggling_forbidden');
  }

  const requests = approvalGateResult?.approvalRequests;
  if (!Array.isArray(requests) || requests.length === 0) return blocked('missing_approval_requests');
  if (!Array.isArray(verifiedApprovalRecords) || verifiedApprovalRecords.length !== requests.length) {
    return blocked('approval_record_count_mismatch');
  }

  const requestIds = new Set();
  const recordIds = new Set();
  const recordsByRequest = new Map();

  for (const record of verifiedApprovalRecords) {
    const requestId = text(record?.approvalRequestId);
    if (!requestId) return blocked('missing_approval_record_request_id');
    if (recordsByRequest.has(requestId)) return blocked('duplicate_approval_record_request');
    recordsByRequest.set(requestId, record);
  }

  const decisions = [];
  for (let index = 0; index < requests.length; index += 1) {
    const requestResult = validateApprovalRequest(requests[index], index + 1);
    if (!requestResult.ok) return blocked(requestResult.reason);
    const request = requestResult.value;

    if (requestIds.has(request.approvalRequestId)) return blocked('duplicate_approval_request');
    requestIds.add(request.approvalRequestId);

    const recordResult = validateVerifiedRecord(recordsByRequest.get(request.approvalRequestId), request);
    if (!recordResult.ok) return blocked(recordResult.reason);
    const record = recordResult.value;

    if (recordIds.has(record.approvalRecordId)) return blocked('duplicate_approval_record');
    recordIds.add(record.approvalRecordId);

    const approved = record.decision === 'approved';
    decisions.push({
      permissionDecisionId: `PD:${request.approvalRequestId}`,
      approvalRecordId: record.approvalRecordId,
      approvalRequestId: request.approvalRequestId,
      taskDraftId: request.taskDraftId,
      decisionCandidateId: request.decisionCandidateId,
      decisionItemId: request.decisionItemId,
      priorityRank: request.priorityRank,
      eventId: request.eventId,
      builderRunId: request.builderRunId,
      conflictRunId: request.conflictRunId,
      reviewerId: record.reviewerId,
      approvalDecision: record.decision,
      decidedAt: record.decidedAt,
      verificationSource: record.verificationSource,
      verificationVersion: record.verificationVersion,
      permissionGranted: approved,
      dispatchGateEligible: approved,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    });
  }

  return {
    status: 'permission_decisions_ready',
    permissionDecisionEligible: true,
    nextAction: 'continue_to_dispatch_gate',
    permissionDecisions: decisions,
    executionAuthorized: false,
    dispatchAuthorized: false,
    reasons: [],
    contractVersion: S04_PERMISSION_DECISION_VERSION,
  };
}
