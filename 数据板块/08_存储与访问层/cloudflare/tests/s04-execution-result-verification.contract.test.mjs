import assert from 'node:assert/strict';
import { S04_EXECUTION_RESULT_VERSION } from '../s04-execution-result.js';
import { verifyS04ExecutionResults, S04_EXECUTION_RESULT_VERIFICATION_VERSION } from '../s04-execution-result-verification.js';

const contract = (overrides = {}) => ({
  executionResultContractId: 'ER:DE:DG:PD:AR:TD:DC:DI:EVT-1:01',
  dispatchEnvelopeId: 'DE:DG:PD:AR:TD:DC:DI:EVT-1:01',
  dispatchCandidateId: 'DG:PD:AR:TD:DC:DI:EVT-1:01',
  permissionDecisionId: 'PD:AR:TD:DC:DI:EVT-1:01',
  approvalRequestId: 'AR:TD:DC:DI:EVT-1:01',
  taskDraftId: 'TD:DC:DI:EVT-1:01',
  decisionCandidateId: 'DC:DI:EVT-1:01',
  decisionItemId: 'DI:EVT-1:01',
  priorityRank: 1,
  eventId: 'EVT-1',
  builderRunId: 'BR-1',
  conflictRunId: 'CR-1',
  resultState: 'awaiting_trusted_executor_attestation',
  acceptanceMode: 'verified_only',
  resultAccepted: false,
  readOnly: true,
  dispatchAuthorized: false,
  executionAuthorized: false,
  ...overrides,
});

const parent = (items = [contract()], overrides = {}) => ({
  status: 'execution_result_contracts_ready',
  executionResultIntakeEligible: true,
  nextAction: 'continue_to_execution_result_verification',
  executionResultContracts: items,
  resultAccepted: false,
  dispatchAuthorized: false,
  executionAuthorized: false,
  reasons: [],
  contractVersion: S04_EXECUTION_RESULT_VERSION,
  ...overrides,
});

const attestation = (overrides = {}) => ({
  attestationId: 'EA-1',
  executorId: 'executor-readonly-1',
  executionResultContractId: 'ER:DE:DG:PD:AR:TD:DC:DI:EVT-1:01',
  dispatchEnvelopeId: 'DE:DG:PD:AR:TD:DC:DI:EVT-1:01',
  decisionItemId: 'DI:EVT-1:01',
  priorityRank: 1,
  eventId: 'EVT-1',
  builderRunId: 'BR-1',
  conflictRunId: 'CR-1',
  trustDomain: 'approved_executor_registry',
  verificationState: 'verified',
  resultStatus: 'no_change',
  observedAt: '2026-09-03T00:00:00Z',
  dispatchAuthorized: false,
  executionAuthorized: false,
  ...overrides,
});

const happy = verifyS04ExecutionResults(parent(), [attestation()]);
assert.equal(happy.contractVersion, S04_EXECUTION_RESULT_VERIFICATION_VERSION);
assert.equal(happy.status, 'execution_results_verified');
assert.equal(happy.executionResultVerificationEligible, true);
assert.equal(happy.nextAction, 'continue_to_audit_envelope');
assert.equal(happy.resultAccepted, true);
assert.equal(happy.auditEligible, true);
assert.equal(happy.dispatchAuthorized, false);
assert.equal(happy.executionAuthorized, false);
assert.equal(happy.verifiedExecutionResults.length, 1);
assert.equal(happy.verifiedExecutionResults[0].verificationState, 'verified_read_only');
assert.equal(happy.verifiedExecutionResults[0].auditEligible, true);
assert.equal(happy.verifiedExecutionResults[0].readOnly, true);
assert.equal(happy.verifiedExecutionResults[0].dispatchAuthorized, false);
assert.equal(happy.verifiedExecutionResults[0].executionAuthorized, false);

assert.deepEqual(verifyS04ExecutionResults(parent(undefined, { status: 'blocked' }), [attestation()]).reasons, ['execution_result_contracts_not_released']);
assert.deepEqual(verifyS04ExecutionResults(parent(undefined, { contractVersion: 'forged-version' }), [attestation()]).reasons, ['unsupported_execution_result_contract_version']);
assert.deepEqual(verifyS04ExecutionResults(parent(undefined, { resultAccepted: true }), [attestation()]).reasons, ['preaccepted_execution_result_forbidden']);
assert.deepEqual(verifyS04ExecutionResults(parent(undefined, { executionAuthorized: true }), [attestation()]).reasons, ['execution_result_parent_authorization_smuggling_forbidden']);
assert.deepEqual(verifyS04ExecutionResults(parent([]), []).reasons, ['missing_execution_result_contracts']);
assert.deepEqual(verifyS04ExecutionResults(parent(), []).reasons, ['executor_attestation_cardinality_mismatch']);
assert.deepEqual(verifyS04ExecutionResults(parent([contract({ executionResultContractId: 'ER:FORGED' })]), [attestation({ executionResultContractId: 'ER:FORGED' })]).reasons, ['execution_result_contract_identity_mismatch']);
assert.deepEqual(verifyS04ExecutionResults(parent([contract({ acceptanceMode: 'unverified' })]), [attestation()]).reasons, ['execution_result_contract_not_verified_only']);
assert.deepEqual(verifyS04ExecutionResults(parent([contract({ readOnly: false })]), [attestation()]).reasons, ['execution_result_contract_not_read_only']);
assert.deepEqual(verifyS04ExecutionResults(parent(), [attestation({ trustDomain: 'caller_claim' })]).reasons, ['untrusted_executor_attestation']);
assert.deepEqual(verifyS04ExecutionResults(parent(), [attestation({ verificationState: 'claimed' })]).reasons, ['executor_attestation_not_verified']);
assert.deepEqual(verifyS04ExecutionResults(parent(), [attestation({ eventId: 'EVT-FORGED' })]).reasons, ['executor_attestation_lineage_mismatch']);
assert.deepEqual(verifyS04ExecutionResults(parent(), [attestation({ resultStatus: 'unknown' })]).reasons, ['invalid_execution_result_status']);
assert.deepEqual(verifyS04ExecutionResults(parent(), [attestation({ executionAuthorized: true })]).reasons, ['executor_attestation_authorization_smuggling_forbidden']);
assert.deepEqual(
  verifyS04ExecutionResults(
    parent([
      contract(),
      contract({ priorityRank: 2 }),
    ]),
    [
      attestation(),
      attestation({
        attestationId: 'EA-2',
        executionResultContractId: 'ER:UNRELATED',
      }),
    ],
  ).reasons,
  ['duplicate_execution_result_contract'],
);
assert.deepEqual(
  verifyS04ExecutionResults(
    parent([
      contract(),
      contract({
        executionResultContractId: 'ER:DE:DG:PD:AR:TD:DC:DI:EVT-2:02',
        dispatchEnvelopeId: 'DE:DG:PD:AR:TD:DC:DI:EVT-2:02',
        dispatchCandidateId: 'DG:PD:AR:TD:DC:DI:EVT-2:02',
        permissionDecisionId: 'PD:AR:TD:DC:DI:EVT-2:02',
        approvalRequestId: 'AR:TD:DC:DI:EVT-2:02',
        taskDraftId: 'TD:DC:DI:EVT-2:02',
        decisionCandidateId: 'DC:DI:EVT-2:02',
        decisionItemId: 'DI:EVT-2:02',
        priorityRank: 2,
        eventId: 'EVT-2',
      }),
    ]),
    [
      attestation(),
      attestation({
        executionResultContractId: 'ER:DE:DG:PD:AR:TD:DC:DI:EVT-2:02',
        dispatchEnvelopeId: 'DE:DG:PD:AR:TD:DC:DI:EVT-2:02',
        decisionItemId: 'DI:EVT-2:02',
        priorityRank: 2,
        eventId: 'EVT-2',
      }),
    ],
  ).reasons,
  ['duplicate_executor_attestation_id'],
);

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_EXECUTION_RESULT_VERIFICATION_VERSION,
  happyPath: happy.nextAction,
  failClosedCaseCount: 16,
}, null, 2));
