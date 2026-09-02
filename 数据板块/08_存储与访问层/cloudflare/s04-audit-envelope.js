import { S04_EXECUTION_RESULT_VERIFICATION_VERSION } from './s04-execution-result-verification.js';

export const S04_AUDIT_ENVELOPE_VERSION = 'S04-audit-envelope-v0.1.0';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    auditEnvelopeEligible: false,
    nextAction: 'hold_for_review',
    auditEnvelopes: [],
    auditReady: false,
    stateTransitionAuthorized: false,
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [reason],
    contractVersion: S04_AUDIT_ENVELOPE_VERSION,
  };
}

function validateVerifiedResult(item, expectedRank) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { ok: false, reason: 'invalid_verified_execution_result_shape' };
  }

  const verifiedExecutionResultId = text(item.verifiedExecutionResultId);
  const executionResultContractId = text(item.executionResultContractId);
  const dispatchEnvelopeId = text(item.dispatchEnvelopeId);
  const dispatchCandidateId = text(item.dispatchCandidateId);
  const permissionDecisionId = text(item.permissionDecisionId);
  const approvalRequestId = text(item.approvalRequestId);
  const taskDraftId = text(item.taskDraftId);
  const decisionCandidateId = text(item.decisionCandidateId);
  const decisionItemId = text(item.decisionItemId);
  const attestationId = text(item.attestationId);
  const executorId = text(item.executorId);
  const observedAt = text(item.observedAt);
  const eventId = text(item.eventId);
  const builderRunId = text(item.builderRunId);
  const conflictRunId = text(item.conflictRunId);
  const resultStatus = text(item.resultStatus);
  const priorityRank = Number(item.priorityRank);

  if (!verifiedExecutionResultId || !executionResultContractId || !dispatchEnvelopeId || !dispatchCandidateId || !permissionDecisionId || !approvalRequestId || !taskDraftId || !decisionCandidateId || !decisionItemId) {
    return { ok: false, reason: 'missing_audit_source_identity' };
  }
  if (verifiedExecutionResultId !== `VR:${executionResultContractId}`) return { ok: false, reason: 'verified_result_identity_mismatch' };
  if (executionResultContractId !== `ER:${dispatchEnvelopeId}`) return { ok: false, reason: 'audit_execution_result_contract_identity_mismatch' };
  if (dispatchEnvelopeId !== `DE:${dispatchCandidateId}`) return { ok: false, reason: 'audit_dispatch_envelope_identity_mismatch' };
  if (dispatchCandidateId !== `DG:${permissionDecisionId}`) return { ok: false, reason: 'audit_dispatch_candidate_identity_mismatch' };
  if (permissionDecisionId !== `PD:${approvalRequestId}`) return { ok: false, reason: 'audit_permission_decision_identity_mismatch' };
  if (approvalRequestId !== `AR:${taskDraftId}`) return { ok: false, reason: 'audit_approval_request_identity_mismatch' };
  if (taskDraftId !== `TD:${decisionCandidateId}`) return { ok: false, reason: 'audit_task_draft_identity_mismatch' };
  if (decisionCandidateId !== `DC:${decisionItemId}`) return { ok: false, reason: 'audit_decision_candidate_identity_mismatch' };
  if (!Number.isInteger(priorityRank) || priorityRank !== expectedRank) return { ok: false, reason: 'invalid_audit_priority_rank' };
  if (!eventId || !builderRunId || !conflictRunId || !attestationId || !executorId || !observedAt) return { ok: false, reason: 'missing_audit_lineage_or_proof' };
  if (!['succeeded', 'failed', 'no_change'].includes(resultStatus)) return { ok: false, reason: 'invalid_audit_result_status' };
  if (item.verificationState !== 'verified_read_only') return { ok: false, reason: 'audit_source_not_verified_read_only' };
  if (item.auditEligible !== true) return { ok: false, reason: 'audit_source_not_eligible' };
  if (item.readOnly !== true) return { ok: false, reason: 'audit_source_not_read_only' };
  if (item.dispatchAuthorized !== false || item.executionAuthorized !== false) return { ok: false, reason: 'audit_source_authorization_smuggling_forbidden' };
  if (item.auditEnvelopeId || item.auditState || item.stateTransitionAuthorized === true) return { ok: false, reason: 'preloaded_audit_state_forbidden' };

  return {
    ok: true,
    value: {
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
 * Wraps verified execution facts in immutable, read-only audit envelopes.
 * This boundary records provenance only. It never dispatches, executes, retries,
 * mutates production systems, or authorizes a state transition.
 */
export function buildS04AuditEnvelopes(verificationResult) {
  if (
    verificationResult?.status !== 'execution_results_verified' ||
    verificationResult?.executionResultVerificationEligible !== true ||
    verificationResult?.nextAction !== 'continue_to_audit_envelope' ||
    verificationResult?.auditEligible !== true
  ) {
    return blocked('verified_execution_results_not_released_for_audit');
  }
  if (text(verificationResult?.contractVersion) !== S04_EXECUTION_RESULT_VERIFICATION_VERSION) return blocked('unsupported_execution_result_verification_version');
  if (verificationResult?.resultAccepted !== true) return blocked('unaccepted_execution_result_forbidden');
  if (verificationResult?.dispatchAuthorized === true || verificationResult?.executionAuthorized === true || verificationResult?.stateTransitionAuthorized === true) {
    return blocked('audit_parent_authorization_smuggling_forbidden');
  }

  const verifiedResults = verificationResult?.verifiedExecutionResults;
  if (!Array.isArray(verifiedResults) || verifiedResults.length === 0) return blocked('missing_verified_execution_results');

  const verifiedIds = new Set();
  const auditIds = new Set();
  const auditEnvelopes = [];

  for (let index = 0; index < verifiedResults.length; index += 1) {
    const checked = validateVerifiedResult(verifiedResults[index], index + 1);
    if (!checked.ok) return blocked(checked.reason);
    const source = checked.value;

    if (verifiedIds.has(source.verifiedExecutionResultId)) return blocked('duplicate_verified_execution_result');
    verifiedIds.add(source.verifiedExecutionResultId);

    const auditEnvelopeId = `AU:${source.verifiedExecutionResultId}`;
    if (auditIds.has(auditEnvelopeId)) return blocked('duplicate_audit_envelope_identity');
    auditIds.add(auditEnvelopeId);

    auditEnvelopes.push({
      auditEnvelopeId,
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
      auditState: 'audit_ready_read_only',
      provenanceMode: 'immutable_lineage',
      readOnly: true,
      stateTransitionAuthorized: false,
      dispatchAuthorized: false,
      executionAuthorized: false,
    });
  }

  return {
    status: 'audit_envelopes_ready',
    auditEnvelopeEligible: true,
    nextAction: 'continue_to_state_machine_validation',
    auditEnvelopes,
    auditReady: true,
    stateTransitionAuthorized: false,
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [],
    contractVersion: S04_AUDIT_ENVELOPE_VERSION,
  };
}
