import { S04_EXECUTION_RESULT_VERSION } from './s04-execution-result.js';

export const S04_EXECUTION_RESULT_VERIFICATION_VERSION = 'S04-execution-result-verification-v0.1.0';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    executionResultVerificationEligible: false,
    nextAction: 'hold_for_review',
    verifiedExecutionResults: [],
    resultAccepted: false,
    auditEligible: false,
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [reason],
    contractVersion: S04_EXECUTION_RESULT_VERIFICATION_VERSION,
  };
}

function validateContract(item, expectedRank) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return { ok: false, reason: 'invalid_execution_result_contract_shape' };
  }

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
  const priorityRank = Number(item.priorityRank);

  if (!executionResultContractId || !dispatchEnvelopeId || !dispatchCandidateId || !permissionDecisionId || !approvalRequestId || !taskDraftId || !decisionCandidateId || !decisionItemId) {
    return { ok: false, reason: 'missing_execution_result_contract_identity' };
  }
  if (executionResultContractId !== `ER:${dispatchEnvelopeId}`) return { ok: false, reason: 'execution_result_contract_identity_mismatch' };
  if (dispatchEnvelopeId !== `DE:${dispatchCandidateId}`) return { ok: false, reason: 'verification_dispatch_envelope_identity_mismatch' };
  if (dispatchCandidateId !== `DG:${permissionDecisionId}`) return { ok: false, reason: 'verification_dispatch_candidate_identity_mismatch' };
  if (permissionDecisionId !== `PD:${approvalRequestId}`) return { ok: false, reason: 'verification_permission_decision_identity_mismatch' };
  if (approvalRequestId !== `AR:${taskDraftId}`) return { ok: false, reason: 'verification_approval_request_identity_mismatch' };
  if (taskDraftId !== `TD:${decisionCandidateId}`) return { ok: false, reason: 'verification_task_draft_identity_mismatch' };
  if (decisionCandidateId !== `DC:${decisionItemId}`) return { ok: false, reason: 'verification_decision_candidate_identity_mismatch' };
  if (!Number.isInteger(priorityRank) || priorityRank !== expectedRank) return { ok: false, reason: 'invalid_verification_priority_rank' };
  if (!eventId || !builderRunId || !conflictRunId) return { ok: false, reason: 'missing_verification_lineage' };
  if (item.resultState !== 'awaiting_trusted_executor_attestation') return { ok: false, reason: 'execution_result_contract_not_awaiting_attestation' };
  if (item.acceptanceMode !== 'verified_only') return { ok: false, reason: 'execution_result_contract_not_verified_only' };
  if (item.resultAccepted !== false) return { ok: false, reason: 'preaccepted_execution_result_forbidden' };
  if (item.readOnly !== true) return { ok: false, reason: 'execution_result_contract_not_read_only' };
  if (item.dispatchAuthorized !== false || item.executionAuthorized !== false) return { ok: false, reason: 'execution_result_contract_authorization_smuggling_forbidden' };

  return {
    ok: true,
    value: {
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
    },
  };
}

function validateAttestation(attestation, contract) {
  if (!attestation || typeof attestation !== 'object' || Array.isArray(attestation)) {
    return { ok: false, reason: 'invalid_executor_attestation_shape' };
  }

  const attestationId = text(attestation.attestationId);
  const executorId = text(attestation.executorId);
  const executionResultContractId = text(attestation.executionResultContractId);
  const observedAt = text(attestation.observedAt);
  const resultStatus = text(attestation.resultStatus);

  if (!attestationId || !executorId || !executionResultContractId || !observedAt) return { ok: false, reason: 'missing_trusted_executor_attestation_identity' };
  if (executionResultContractId !== contract.executionResultContractId) return { ok: false, reason: 'executor_attestation_contract_mismatch' };
  if (text(attestation.dispatchEnvelopeId) !== contract.dispatchEnvelopeId || text(attestation.decisionItemId) !== contract.decisionItemId) {
    return { ok: false, reason: 'executor_attestation_identity_mismatch' };
  }
  if (
    text(attestation.eventId) !== contract.eventId ||
    text(attestation.builderRunId) !== contract.builderRunId ||
    text(attestation.conflictRunId) !== contract.conflictRunId
  ) {
    return { ok: false, reason: 'executor_attestation_lineage_mismatch' };
  }
  if (attestation.priorityRank !== contract.priorityRank) return { ok: false, reason: 'executor_attestation_priority_rank_mismatch' };
  if (attestation.trustDomain !== 'approved_executor_registry') return { ok: false, reason: 'untrusted_executor_attestation' };
  if (attestation.verificationState !== 'verified') return { ok: false, reason: 'executor_attestation_not_verified' };
  if (!['succeeded', 'failed', 'no_change'].includes(resultStatus)) return { ok: false, reason: 'invalid_execution_result_status' };
  if (attestation.dispatchAuthorized === true || attestation.executionAuthorized === true) return { ok: false, reason: 'executor_attestation_authorization_smuggling_forbidden' };

  return {
    ok: true,
    value: {
      attestationId,
      executorId,
      observedAt,
      resultStatus,
    },
  };
}

/**
 * Verifies trusted executor attestations against immutable execution-result contracts.
 * This boundary is read-only: it verifies returned facts but never dispatches, executes,
 * retries, or mutates any external/production system.
 */
export function verifyS04ExecutionResults(executionResultContractResult, trustedAttestations) {
  if (
    executionResultContractResult?.status !== 'execution_result_contracts_ready' ||
    executionResultContractResult?.executionResultIntakeEligible !== true ||
    executionResultContractResult?.nextAction !== 'continue_to_execution_result_verification'
  ) {
    return blocked('execution_result_contracts_not_released');
  }
  if (text(executionResultContractResult?.contractVersion) !== S04_EXECUTION_RESULT_VERSION) return blocked('unsupported_execution_result_contract_version');
  if (executionResultContractResult?.resultAccepted === true) return blocked('preaccepted_execution_result_forbidden');
  if (executionResultContractResult?.dispatchAuthorized === true || executionResultContractResult?.executionAuthorized === true) {
    return blocked('execution_result_parent_authorization_smuggling_forbidden');
  }

  const contracts = executionResultContractResult?.executionResultContracts;
  if (!Array.isArray(contracts) || contracts.length === 0) return blocked('missing_execution_result_contracts');
  if (!Array.isArray(trustedAttestations) || trustedAttestations.length !== contracts.length) return blocked('executor_attestation_cardinality_mismatch');

  const contractIds = new Set();
  const attestationIds = new Set();
  const attestationsByContract = new Map();

  for (const attestation of trustedAttestations) {
    const contractId = text(attestation?.executionResultContractId);
    if (!contractId) return blocked('missing_trusted_executor_attestation_identity');
    if (attestationsByContract.has(contractId)) return blocked('duplicate_executor_attestation_contract');
    attestationsByContract.set(contractId, attestation);
  }

  const verified = [];
  for (let index = 0; index < contracts.length; index += 1) {
    const checkedContract = validateContract(contracts[index], index + 1);
    if (!checkedContract.ok) return blocked(checkedContract.reason);
    const contract = checkedContract.value;
    if (contractIds.has(contract.executionResultContractId)) return blocked('duplicate_execution_result_contract');
    contractIds.add(contract.executionResultContractId);

    const attestation = attestationsByContract.get(contract.executionResultContractId);
    if (!attestation) return blocked('missing_matching_executor_attestation');
    const checkedAttestation = validateAttestation(attestation, contract);
    if (!checkedAttestation.ok) return blocked(checkedAttestation.reason);
    const proof = checkedAttestation.value;
    if (attestationIds.has(proof.attestationId)) return blocked('duplicate_executor_attestation_id');
    attestationIds.add(proof.attestationId);

    verified.push({
      verifiedExecutionResultId: `VR:${contract.executionResultContractId}`,
      executionResultContractId: contract.executionResultContractId,
      dispatchEnvelopeId: contract.dispatchEnvelopeId,
      dispatchCandidateId: contract.dispatchCandidateId,
      permissionDecisionId: contract.permissionDecisionId,
      approvalRequestId: contract.approvalRequestId,
      taskDraftId: contract.taskDraftId,
      decisionCandidateId: contract.decisionCandidateId,
      decisionItemId: contract.decisionItemId,
      priorityRank: contract.priorityRank,
      eventId: contract.eventId,
      builderRunId: contract.builderRunId,
      conflictRunId: contract.conflictRunId,
      attestationId: proof.attestationId,
      executorId: proof.executorId,
      observedAt: proof.observedAt,
      resultStatus: proof.resultStatus,
      verificationState: 'verified_read_only',
      auditEligible: true,
      readOnly: true,
      dispatchAuthorized: false,
      executionAuthorized: false,
    });
  }

  return {
    status: 'execution_results_verified',
    executionResultVerificationEligible: true,
    nextAction: 'continue_to_audit_envelope',
    verifiedExecutionResults: verified,
    resultAccepted: true,
    auditEligible: true,
    dispatchAuthorized: false,
    executionAuthorized: false,
    reasons: [],
    contractVersion: S04_EXECUTION_RESULT_VERIFICATION_VERSION,
  };
}
