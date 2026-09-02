import { S04_PERMISSION_DECISION_VERSION } from './s04-permission-decision.js';

export const S04_DISPATCH_GATE_VERSION = 'S04-dispatch-gate-v0.1.0';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    dispatchGateEligible: false,
    nextAction: 'hold_for_review',
    dispatchCandidates: [],
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [reason],
    contractVersion: S04_DISPATCH_GATE_VERSION,
  };
}

function validatePermissionDecision(item, expectedRank) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { ok: false, reason: 'invalid_permission_decision_shape' };
  }

  const permissionDecisionId = text(item.permissionDecisionId);
  const approvalRequestId = text(item.approvalRequestId);
  const taskDraftId = text(item.taskDraftId);
  const decisionCandidateId = text(item.decisionCandidateId);
  const decisionItemId = text(item.decisionItemId);
  const eventId = text(item.eventId);
  const builderRunId = text(item.builderRunId);
  const conflictRunId = text(item.conflictRunId);
  const priorityRank = Number(item.priorityRank);

  if (!permissionDecisionId || !approvalRequestId || !taskDraftId || !decisionCandidateId || !decisionItemId) {
    return { ok: false, reason: 'missing_dispatch_identity' };
  }
  if (decisionCandidateId !== `DC:${decisionItemId}`) return { ok: false, reason: 'dispatch_decision_candidate_identity_mismatch' };
  if (taskDraftId !== `TD:${decisionCandidateId}`) return { ok: false, reason: 'dispatch_task_draft_identity_mismatch' };
  if (approvalRequestId !== `AR:${taskDraftId}`) return { ok: false, reason: 'dispatch_approval_request_identity_mismatch' };
  if (permissionDecisionId !== `PD:${approvalRequestId}`) return { ok: false, reason: 'dispatch_permission_decision_identity_mismatch' };
  if (!Number.isInteger(priorityRank) || priorityRank !== expectedRank) return { ok: false, reason: 'invalid_dispatch_priority_rank' };
  if (!eventId || !builderRunId || !conflictRunId) return { ok: false, reason: 'missing_dispatch_lineage' };

  if (item.permissionGranted !== true) return { ok: false, reason: 'permission_not_granted' };
  if (item.dispatchGateEligible !== true) return { ok: false, reason: 'permission_not_dispatch_gate_eligible' };
  if (item.readOnly !== true) return { ok: false, reason: 'permission_decision_not_read_only' };
  if (item.dispatchAuthorized !== false) return { ok: false, reason: 'dispatch_authorization_smuggling_forbidden' };
  if (item.executionAuthorized !== false) return { ok: false, reason: 'execution_authorization_smuggling_forbidden' };

  return {
    ok: true,
    value: {
      permissionDecisionId,
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

/**
 * Read-only dispatch gate. It creates dispatch candidates only; it never dispatches
 * work and never authorizes execution. Any malformed, duplicated, unapproved, or
 * authorization-carrying input fails the whole batch closed.
 */
export function createS04DispatchCandidates(permissionDecisionResult) {
  if (
    permissionDecisionResult?.status !== 'permission_decisions_ready' ||
    permissionDecisionResult?.permissionDecisionEligible !== true ||
    permissionDecisionResult?.nextAction !== 'continue_to_dispatch_gate'
  ) {
    return blocked('permission_decisions_not_released');
  }

  if (text(permissionDecisionResult?.contractVersion) !== S04_PERMISSION_DECISION_VERSION) {
    return blocked('unsupported_permission_decision_version');
  }

  if (permissionDecisionResult?.dispatchAuthorized === true || permissionDecisionResult?.executionAuthorized === true) {
    return blocked('permission_result_authorization_smuggling_forbidden');
  }

  const items = permissionDecisionResult?.permissionDecisions;
  if (!Array.isArray(items) || items.length === 0) return blocked('missing_permission_decisions');

  const ids = new Set();
  const candidates = [];

  for (let index = 0; index < items.length; index += 1) {
    const validated = validatePermissionDecision(items[index], index + 1);
    if (!validated.ok) return blocked(validated.reason);
    const item = validated.value;
    if (ids.has(item.permissionDecisionId)) return blocked('duplicate_permission_decision');
    ids.add(item.permissionDecisionId);

    candidates.push({
      dispatchCandidateId: `DG:${item.permissionDecisionId}`,
      permissionDecisionId: item.permissionDecisionId,
      approvalRequestId: item.approvalRequestId,
      taskDraftId: item.taskDraftId,
      decisionCandidateId: item.decisionCandidateId,
      decisionItemId: item.decisionItemId,
      priorityRank: item.priorityRank,
      eventId: item.eventId,
      builderRunId: item.builderRunId,
      conflictRunId: item.conflictRunId,
      dispatchState: 'candidate_only',
      readOnly: true,
      dispatchAuthorized: false,
      executionAuthorized: false,
    });
  }

  return {
    status: 'dispatch_candidates_ready',
    dispatchGateEligible: true,
    nextAction: 'continue_to_dispatch_planning',
    dispatchCandidates: candidates,
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [],
    contractVersion: S04_DISPATCH_GATE_VERSION,
  };
}
