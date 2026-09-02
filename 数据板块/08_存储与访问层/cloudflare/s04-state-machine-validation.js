import { S04_AUDIT_ENVELOPE_VERSION } from './s04-audit-envelope.js';

export const S04_STATE_MACHINE_VALIDATION_VERSION = 'S04-state-machine-validation-v0.1.0';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    stateMachineValidationEligible: false,
    nextAction: 'hold_for_review',
    transitionValidations: [],
    stateTransitionReady: false,
    stateTransitionAuthorized: false,
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [reason],
    contractVersion: S04_STATE_MACHINE_VALIDATION_VERSION,
  };
}

const PROPOSED_STATE_BY_RESULT = Object.freeze({
  succeeded: 'completed',
  failed: 'failed',
  no_change: 'no_change',
});

function validateAuditEnvelope(item, expectedRank) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { ok: false, reason: 'invalid_audit_envelope_shape' };
  }

  const auditEnvelopeId = text(item.auditEnvelopeId);
  const verifiedExecutionResultId = text(item.verifiedExecutionResultId);
  const executionResultContractId = text(item.executionResultContractId);
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
  const attestationId = text(item.attestationId);
  const executorId = text(item.executorId);
  const observedAt = text(item.observedAt);
  const resultStatus = text(item.resultStatus);
  const priorityRank = Number(item.priorityRank);

  if (!auditEnvelopeId || !verifiedExecutionResultId || !executionResultContractId || !dispatchEnvelopeId || !dispatchCandidateId || !permissionDecisionId || !approvalRequestId || !taskDraftId || !decisionCandidateId || !decisionItemId) {
    return { ok: false, reason: 'missing_state_machine_identity' };
  }
  if (auditEnvelopeId !== `AU:${verifiedExecutionResultId}`) return { ok: false, reason: 'audit_envelope_identity_mismatch' };
  if (verifiedExecutionResultId !== `VR:${executionResultContractId}`) return { ok: false, reason: 'state_machine_verified_result_identity_mismatch' };
  if (executionResultContractId !== `ER:${dispatchEnvelopeId}`) return { ok: false, reason: 'state_machine_execution_result_identity_mismatch' };
  if (dispatchEnvelopeId !== `DE:${dispatchCandidateId}`) return { ok: false, reason: 'state_machine_dispatch_envelope_identity_mismatch' };
  if (dispatchCandidateId !== `DG:${permissionDecisionId}`) return { ok: false, reason: 'state_machine_dispatch_candidate_identity_mismatch' };
  if (permissionDecisionId !== `PD:${approvalRequestId}`) return { ok: false, reason: 'state_machine_permission_identity_mismatch' };
  if (approvalRequestId !== `AR:${taskDraftId}`) return { ok: false, reason: 'state_machine_approval_identity_mismatch' };
  if (taskDraftId !== `TD:${decisionCandidateId}`) return { ok: false, reason: 'state_machine_task_identity_mismatch' };
  if (decisionCandidateId !== `DC:${decisionItemId}`) return { ok: false, reason: 'state_machine_decision_identity_mismatch' };
  if (!Number.isInteger(priorityRank) || priorityRank !== expectedRank) return { ok: false, reason: 'invalid_state_machine_priority_rank' };
  if (!eventId || !builderRunId || !conflictRunId || !attestationId || !executorId || !observedAt) return { ok: false, reason: 'missing_state_machine_lineage_or_proof' };
  if (!Object.hasOwn(PROPOSED_STATE_BY_RESULT, resultStatus)) return { ok: false, reason: 'invalid_state_machine_result_status' };
  if (item.auditState !== 'audit_ready_read_only' || item.provenanceMode !== 'immutable_lineage' || item.readOnly !== true) {
    return { ok: false, reason: 'audit_envelope_not_read_only_ready' };
  }
  if (item.stateTransitionAuthorized !== false || item.dispatchAuthorized !== false || item.executionAuthorized !== false) {
    return { ok: false, reason: 'state_machine_authorization_smuggling_forbidden' };
  }
  if (item.transitionValidationId || item.currentState || item.proposedState || item.transitionState) {
    return { ok: false, reason: 'preloaded_state_machine_result_forbidden' };
  }

  return {
    ok: true,
    value: {
      auditEnvelopeId,
      verifiedExecutionResultId,
      executionResultContractId,
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
      attestationId,
      executorId,
      observedAt,
      resultStatus,
    },
  };
}

/**
 * Validates a deterministic state-transition proposal from immutable audit facts.
 * It never mutates state and never authorizes dispatch, execution, or transition.
 */
export function validateS04StateMachine(auditResult) {
  if (
    auditResult?.status !== 'audit_envelopes_ready' ||
    auditResult?.auditEnvelopeEligible !== true ||
    auditResult?.nextAction !== 'continue_to_state_machine_validation' ||
    auditResult?.auditReady !== true
  ) {
    return blocked('audit_envelopes_not_released_for_state_machine_validation');
  }
  if (text(auditResult?.contractVersion) !== S04_AUDIT_ENVELOPE_VERSION) return blocked('unsupported_audit_envelope_version');
  if (auditResult?.stateTransitionAuthorized !== false || auditResult?.dispatchAuthorized !== false || auditResult?.executionAuthorized !== false) {
    return blocked('state_machine_parent_authorization_smuggling_forbidden');
  }

  const auditEnvelopes = auditResult?.auditEnvelopes;
  if (!Array.isArray(auditEnvelopes) || auditEnvelopes.length === 0) return blocked('missing_audit_envelopes');

  const auditIds = new Set();
  const validationIds = new Set();
  const transitionValidations = [];

  for (let index = 0; index < auditEnvelopes.length; index += 1) {
    const checked = validateAuditEnvelope(auditEnvelopes[index], index + 1);
    if (!checked.ok) return blocked(checked.reason);
    const source = checked.value;

    if (auditIds.has(source.auditEnvelopeId)) return blocked('duplicate_audit_envelope');
    auditIds.add(source.auditEnvelopeId);

    const transitionValidationId = `SMV:${source.auditEnvelopeId}`;
    if (validationIds.has(transitionValidationId)) return blocked('duplicate_transition_validation_identity');
    validationIds.add(transitionValidationId);

    transitionValidations.push({
      transitionValidationId,
      auditEnvelopeId: source.auditEnvelopeId,
      verifiedExecutionResultId: source.verifiedExecutionResultId,
      executionResultContractId: source.executionResultContractId,
      dispatchEnvelopeId: source.dispatchEnvelopeId,
      dispatchCandidateId: source.dispatchCandidateId,
      permissionDecisionId: source.permissionDecisionId,
      approvalRequestId: source.approvalRequestId,
      taskDraftId: source.taskDraftId,
      decisionCandidateId: source.decisionCandidateId,
      decisionItemId: source.decisionItemId,
      priorityRank: source.priorityRank,
      eventId: source.eventId,
      builderRunId: source.builderRunId,
      conflictRunId: source.conflictRunId,
      attestationId: source.attestationId,
      executorId: source.executorId,
      observedAt: source.observedAt,
      resultStatus: source.resultStatus,
      currentState: 'audit_ready_read_only',
      proposedState: PROPOSED_STATE_BY_RESULT[source.resultStatus],
      transitionState: 'validated_read_only',
      readOnly: true,
      stateTransitionAuthorized: false,
      dispatchAuthorized: false,
      executionAuthorized: false,
    });
  }

  return {
    status: 'state_machine_validated',
    stateMachineValidationEligible: true,
    nextAction: 'continue_to_e2e_closed_loop_validation',
    transitionValidations,
    stateTransitionReady: true,
    stateTransitionAuthorized: false,
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [],
    contractVersion: S04_STATE_MACHINE_VALIDATION_VERSION,
  };
}
