import { S04_DISPATCH_ENVELOPE_VERSION } from './s04-dispatch-envelope.js';

export const S04_EXECUTION_RESULT_VERSION = 'S04-execution-result-v0.1.0';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    executionResultIntakeEligible: false,
    nextAction: 'hold_for_review',
    executionResultContracts: [],
    resultAccepted: false,
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [reason],
    contractVersion: S04_EXECUTION_RESULT_VERSION,
  };
}

function validateEnvelope(item, expectedRank) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { ok: false, reason: 'invalid_execution_result_envelope_shape' };
  }

  const dispatchEnvelopeId = text(item.dispatchEnvelopeId);
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

  if (!dispatchEnvelopeId || !dispatchCandidateId || !permissionDecisionId || !approvalRequestId || !taskDraftId || !decisionCandidateId || !decisionItemId) {
    return { ok: false, reason: 'missing_execution_result_identity' };
  }
  if (decisionCandidateId !== `DC:${decisionItemId}`) return { ok: false, reason: 'execution_result_decision_candidate_identity_mismatch' };
  if (taskDraftId !== `TD:${decisionCandidateId}`) return { ok: false, reason: 'execution_result_task_draft_identity_mismatch' };
  if (approvalRequestId !== `AR:${taskDraftId}`) return { ok: false, reason: 'execution_result_approval_request_identity_mismatch' };
  if (permissionDecisionId !== `PD:${approvalRequestId}`) return { ok: false, reason: 'execution_result_permission_decision_identity_mismatch' };
  if (dispatchCandidateId !== `DG:${permissionDecisionId}`) return { ok: false, reason: 'execution_result_dispatch_candidate_identity_mismatch' };
  if (dispatchEnvelopeId !== `DE:${dispatchCandidateId}`) return { ok: false, reason: 'execution_result_dispatch_envelope_identity_mismatch' };
  if (!Number.isInteger(priorityRank) || priorityRank !== expectedRank) return { ok: false, reason: 'invalid_execution_result_priority_rank' };
  if (!eventId || !builderRunId || !conflictRunId) return { ok: false, reason: 'missing_execution_result_lineage' };

  if (item.envelopeState !== 'planned_read_only') return { ok: false, reason: 'execution_result_envelope_not_planned_read_only' };
  if (item.routingMode !== 'unassigned') return { ok: false, reason: 'execution_result_routing_must_be_unassigned' };
  if (item.deliveryIntent !== 'none') return { ok: false, reason: 'execution_result_delivery_intent_must_be_none' };
  if (item.readOnly !== true) return { ok: false, reason: 'execution_result_envelope_not_read_only' };
  if (item.dispatchAuthorized !== false) return { ok: false, reason: 'execution_result_dispatch_authorization_smuggling_forbidden' };
  if (item.executionAuthorized !== false) return { ok: false, reason: 'execution_result_authorization_smuggling_forbidden' };

  return {
    ok: true,
    value: {
      dispatchEnvelopeId,
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
 * Defines the fail-closed boundary for future execution-result return.
 * This stage does not execute, dispatch, accept a claimed result, or mutate external state.
 * It only creates immutable result-intake contracts that require a later trusted executor attestation.
 */
export function createS04ExecutionResultContracts(dispatchEnvelopeResult) {
  if (
    dispatchEnvelopeResult?.status !== 'dispatch_envelopes_ready' ||
    dispatchEnvelopeResult?.dispatchPlanningEligible !== true ||
    dispatchEnvelopeResult?.nextAction !== 'continue_to_execution_result_contract'
  ) {
    return blocked('dispatch_envelopes_not_released');
  }

  if (text(dispatchEnvelopeResult?.contractVersion) !== S04_DISPATCH_ENVELOPE_VERSION) {
    return blocked('unsupported_dispatch_envelope_version');
  }

  if (dispatchEnvelopeResult?.dispatchAuthorized === true || dispatchEnvelopeResult?.executionAuthorized === true) {
    return blocked('dispatch_envelope_authorization_smuggling_forbidden');
  }

  if (dispatchEnvelopeResult?.executionResult !== undefined || dispatchEnvelopeResult?.resultAccepted === true) {
    return blocked('preloaded_execution_result_forbidden');
  }

  const items = dispatchEnvelopeResult?.dispatchEnvelopes;
  if (!Array.isArray(items) || items.length === 0) return blocked('missing_dispatch_envelopes');

  const ids = new Set();
  const contracts = [];

  for (let index = 0; index < items.length; index += 1) {
    const validated = validateEnvelope(items[index], index + 1);
    if (!validated.ok) return blocked(validated.reason);
    const item = validated.value;
    if (ids.has(item.dispatchEnvelopeId)) return blocked('duplicate_dispatch_envelope');
    ids.add(item.dispatchEnvelopeId);

    contracts.push({
      executionResultContractId: `ER:${item.dispatchEnvelopeId}`,
      dispatchEnvelopeId: item.dispatchEnvelopeId,
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
      resultState: 'awaiting_trusted_executor_attestation',
      acceptanceMode: 'verified_only',
      resultAccepted: false,
      readOnly: true,
      dispatchAuthorized: false,
      executionAuthorized: false,
    });
  }

  return {
    status: 'execution_result_contracts_ready',
    executionResultIntakeEligible: true,
    nextAction: 'continue_to_execution_result_verification',
    executionResultContracts: contracts,
    resultAccepted: false,
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [],
    contractVersion: S04_EXECUTION_RESULT_VERSION,
  };
}
