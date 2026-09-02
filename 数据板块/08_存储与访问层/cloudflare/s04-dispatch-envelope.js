import { S04_DISPATCH_GATE_VERSION } from './s04-dispatch-gate.js';

export const S04_DISPATCH_ENVELOPE_VERSION = 'S04-dispatch-envelope-v0.1.0';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    dispatchPlanningEligible: false,
    nextAction: 'hold_for_review',
    dispatchEnvelopes: [],
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [reason],
    contractVersion: S04_DISPATCH_ENVELOPE_VERSION,
  };
}

function validateDispatchCandidate(item, expectedRank) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { ok: false, reason: 'invalid_dispatch_candidate_shape' };
  }

  const dispatchCandidateId = text(item.dispatchCandidateId);
  const permissionDecisionId = text(item.permissionDecisionId);
  const approvalRequestId = text(item.approvalRequestId);
  const taskDraftId = text(item.taskDraftId);
  const decisionCandidateId = text(item.decisionCandidateId);
  const decisionItemId = text(item.decisionItemId);
  const eventId = text(item.eventId);
  const builderRunId = text(item.builderRunId);
  const conflictRunId = text(item.conflictRunId);
  const priorityRank = Number(item.priorityRank);

  if (!dispatchCandidateId || !permissionDecisionId || !approvalRequestId || !taskDraftId || !decisionCandidateId || !decisionItemId) {
    return { ok: false, reason: 'missing_dispatch_envelope_identity' };
  }
  if (decisionCandidateId !== `DC:${decisionItemId}`) return { ok: false, reason: 'dispatch_envelope_decision_candidate_identity_mismatch' };
  if (taskDraftId !== `TD:${decisionCandidateId}`) return { ok: false, reason: 'dispatch_envelope_task_draft_identity_mismatch' };
  if (approvalRequestId !== `AR:${taskDraftId}`) return { ok: false, reason: 'dispatch_envelope_approval_request_identity_mismatch' };
  if (permissionDecisionId !== `PD:${approvalRequestId}`) return { ok: false, reason: 'dispatch_envelope_permission_decision_identity_mismatch' };
  if (dispatchCandidateId !== `DG:${permissionDecisionId}`) return { ok: false, reason: 'dispatch_candidate_identity_mismatch' };
  if (!Number.isInteger(priorityRank) || priorityRank !== expectedRank) return { ok: false, reason: 'invalid_dispatch_envelope_priority_rank' };
  if (!eventId || !builderRunId || !conflictRunId) return { ok: false, reason: 'missing_dispatch_envelope_lineage' };

  if (item.dispatchState !== 'candidate_only') return { ok: false, reason: 'dispatch_candidate_not_candidate_only' };
  if (item.readOnly !== true) return { ok: false, reason: 'dispatch_candidate_not_read_only' };
  if (item.dispatchAuthorized !== false) return { ok: false, reason: 'dispatch_authorization_smuggling_forbidden' };
  if (item.executionAuthorized !== false) return { ok: false, reason: 'execution_authorization_smuggling_forbidden' };

  return {
    ok: true,
    value: {
      dispatchCandidateId,
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
 * Read-only dispatch planning boundary. It creates immutable planning envelopes only.
 * It never selects a production destination, dispatches work, or authorizes execution.
 * Any malformed, duplicated, or authorization-carrying input fails the whole batch closed.
 */
export function createS04DispatchEnvelopes(dispatchGateResult) {
  if (
    dispatchGateResult?.status !== 'dispatch_candidates_ready' ||
    dispatchGateResult?.dispatchGateEligible !== true ||
    dispatchGateResult?.nextAction !== 'continue_to_dispatch_planning'
  ) {
    return blocked('dispatch_candidates_not_released');
  }

  if (text(dispatchGateResult?.contractVersion) !== S04_DISPATCH_GATE_VERSION) {
    return blocked('unsupported_dispatch_gate_version');
  }

  if (dispatchGateResult?.dispatchAuthorized === true || dispatchGateResult?.executionAuthorized === true) {
    return blocked('dispatch_gate_authorization_smuggling_forbidden');
  }

  const items = dispatchGateResult?.dispatchCandidates;
  if (!Array.isArray(items) || items.length === 0) return blocked('missing_dispatch_candidates');

  const ids = new Set();
  const envelopes = [];

  for (let index = 0; index < items.length; index += 1) {
    const validated = validateDispatchCandidate(items[index], index + 1);
    if (!validated.ok) return blocked(validated.reason);
    const item = validated.value;
    if (ids.has(item.dispatchCandidateId)) return blocked('duplicate_dispatch_candidate');
    ids.add(item.dispatchCandidateId);

    envelopes.push({
      dispatchEnvelopeId: `DE:${item.dispatchCandidateId}`,
      dispatchCandidateId: item.dispatchCandidateId,
      permissionDecisionId: item.permissionDecisionId,
      approvalRequestId: item.approvalRequestId,
      taskDraftId: item.taskDraftId,
      decisionCandidateId: item.decisionCandidateId,
      decisionItemId: item.decisionItemId,
      priorityRank: item.priorityRank,
      eventId: item.eventId,
      builderRunId: item.builderRunId,
      conflictRunId: item.conflictRunId,
      envelopeState: 'planned_read_only',
      routingMode: 'unassigned',
      deliveryIntent: 'none',
      readOnly: true,
      dispatchAuthorized: false,
      executionAuthorized: false,
    });
  }

  return {
    status: 'dispatch_envelopes_ready',
    dispatchPlanningEligible: true,
    nextAction: 'continue_to_execution_result_contract',
    dispatchEnvelopes: envelopes,
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [],
    contractVersion: S04_DISPATCH_ENVELOPE_VERSION,
  };
}
