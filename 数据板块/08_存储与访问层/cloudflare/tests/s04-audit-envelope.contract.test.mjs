import assert from 'node:assert/strict';
import { S04_EXECUTION_RESULT_VERIFICATION_VERSION } from '../s04-execution-result-verification.js';
import { buildS04AuditEnvelopes, S04_AUDIT_ENVELOPE_VERSION } from '../s04-audit-envelope.js';

const verified = (overrides = {}) => ({
  verifiedExecutionResultId: 'VR:ER:DE:DG:PD:AR:TD:DC:DI:EVT-1:01',
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
  attestationId: 'EA-1',
  executorId: 'executor-readonly-1',
  observedAt: '2026-09-03T00:00:00Z',
  resultStatus: 'no_change',
  verificationState: 'verified_read_only',
  auditEligible: true,
  readOnly: true,
  dispatchAuthorized: false,
  executionAuthorized: false,
  ...overrides,
});

const parent = (items = [verified()], overrides = {}) => ({
  status: 'execution_results_verified',
  executionResultVerificationEligible: true,
  nextAction: 'continue_to_audit_envelope',
  verifiedExecutionResults: items,
  resultAccepted: true,
  auditEligible: true,
  dispatchAuthorized: false,
  executionAuthorized: false,
  reasons: [],
  contractVersion: S04_EXECUTION_RESULT_VERIFICATION_VERSION,
  ...overrides,
});

const happy = buildS04AuditEnvelopes(parent());
assert.equal(happy.contractVersion, S04_AUDIT_ENVELOPE_VERSION);
assert.equal(happy.status, 'audit_envelopes_ready');
assert.equal(happy.auditEnvelopeEligible, true);
assert.equal(happy.nextAction, 'continue_to_state_machine_validation');
assert.equal(happy.auditReady, true);
assert.equal(happy.stateTransitionAuthorized, false);
assert.equal(happy.dispatchAuthorized, false);
assert.equal(happy.executionAuthorized, false);
assert.equal(happy.auditEnvelopes.length, 1);
assert.equal(happy.auditEnvelopes[0].auditEnvelopeId, 'AU:VR:ER:DE:DG:PD:AR:TD:DC:DI:EVT-1:01');
assert.equal(happy.auditEnvelopes[0].auditState, 'audit_ready_read_only');
assert.equal(happy.auditEnvelopes[0].provenanceMode, 'immutable_lineage');
assert.equal(happy.auditEnvelopes[0].readOnly, true);
assert.equal(happy.auditEnvelopes[0].stateTransitionAuthorized, false);
assert.equal(happy.auditEnvelopes[0].dispatchAuthorized, false);
assert.equal(happy.auditEnvelopes[0].executionAuthorized, false);

assert.deepEqual(buildS04AuditEnvelopes(parent(undefined, { status: 'blocked' })).reasons, ['verified_execution_results_not_released_for_audit']);
assert.deepEqual(buildS04AuditEnvelopes(parent(undefined, { contractVersion: 'forged-version' })).reasons, ['unsupported_execution_result_verification_version']);
assert.deepEqual(buildS04AuditEnvelopes(parent(undefined, { resultAccepted: false })).reasons, ['unaccepted_execution_result_forbidden']);
assert.deepEqual(buildS04AuditEnvelopes(parent(undefined, { executionAuthorized: true })).reasons, ['audit_parent_authorization_smuggling_forbidden']);
assert.deepEqual(buildS04AuditEnvelopes(parent([])).reasons, ['missing_verified_execution_results']);
assert.deepEqual(buildS04AuditEnvelopes(parent([verified({ verifiedExecutionResultId: 'VR:FORGED' })])).reasons, ['verified_result_identity_mismatch']);
assert.deepEqual(buildS04AuditEnvelopes(parent([verified({ eventId: '' })])).reasons, ['missing_audit_lineage_or_proof']);
assert.deepEqual(buildS04AuditEnvelopes(parent([verified({ resultStatus: 'unknown' })])).reasons, ['invalid_audit_result_status']);
assert.deepEqual(buildS04AuditEnvelopes(parent([verified({ verificationState: 'claimed' })])).reasons, ['audit_source_not_verified_read_only']);
assert.deepEqual(buildS04AuditEnvelopes(parent([verified({ auditEligible: false })])).reasons, ['audit_source_not_eligible']);
assert.deepEqual(buildS04AuditEnvelopes(parent([verified({ readOnly: false })])).reasons, ['audit_source_not_read_only']);
assert.deepEqual(buildS04AuditEnvelopes(parent([verified({ dispatchAuthorized: true })])).reasons, ['audit_source_authorization_smuggling_forbidden']);
assert.deepEqual(buildS04AuditEnvelopes(parent([verified({ auditState: 'caller_claim' })])).reasons, ['preloaded_audit_state_forbidden']);
assert.deepEqual(
  buildS04AuditEnvelopes(parent([
    verified(),
    verified({ priorityRank: 2 }),
  ])).reasons,
  ['duplicate_verified_execution_result'],
);

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_AUDIT_ENVELOPE_VERSION,
  happyPath: happy.nextAction,
  failClosedCaseCount: 14,
}, null, 2));
