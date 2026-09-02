import assert from 'node:assert/strict';
import { S04_AUDIT_ENVELOPE_VERSION } from '../s04-audit-envelope.js';
import { validateS04StateMachine, S04_STATE_MACHINE_VALIDATION_VERSION } from '../s04-state-machine-validation.js';

const audit = (overrides = {}) => ({
  auditEnvelopeId: 'AU:VR:ER:DE:DG:PD:AR:TD:DC:DI:EVT-1:01',
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
  auditState: 'audit_ready_read_only',
  provenanceMode: 'immutable_lineage',
  readOnly: true,
  stateTransitionAuthorized: false,
  dispatchAuthorized: false,
  executionAuthorized: false,
  ...overrides,
});

const parent = (items = [audit()], overrides = {}) => ({
  status: 'audit_envelopes_ready',
  auditEnvelopeEligible: true,
  nextAction: 'continue_to_state_machine_validation',
  auditEnvelopes: items,
  auditReady: true,
  stateTransitionAuthorized: false,
  dispatchAuthorized: false,
  executionAuthorized: false,
  reasons: [],
  contractVersion: S04_AUDIT_ENVELOPE_VERSION,
  ...overrides,
});

const happy = validateS04StateMachine(parent());
assert.equal(happy.contractVersion, S04_STATE_MACHINE_VALIDATION_VERSION);
assert.equal(happy.status, 'state_machine_validated');
assert.equal(happy.stateMachineValidationEligible, true);
assert.equal(happy.nextAction, 'continue_to_e2e_closed_loop_validation');
assert.equal(happy.stateTransitionReady, true);
assert.equal(happy.stateTransitionAuthorized, false);
assert.equal(happy.dispatchAuthorized, false);
assert.equal(happy.executionAuthorized, false);
assert.equal(happy.transitionValidations.length, 1);
assert.equal(happy.transitionValidations[0].transitionValidationId, 'SMV:AU:VR:ER:DE:DG:PD:AR:TD:DC:DI:EVT-1:01');
assert.equal(happy.transitionValidations[0].currentState, 'audit_ready_read_only');
assert.equal(happy.transitionValidations[0].proposedState, 'no_change');
assert.equal(happy.transitionValidations[0].transitionState, 'validated_read_only');
assert.equal(happy.transitionValidations[0].readOnly, true);
assert.equal(happy.transitionValidations[0].stateTransitionAuthorized, false);

assert.equal(validateS04StateMachine(parent(undefined, { status: 'blocked' })).nextAction, 'hold_for_review');
assert.deepEqual(validateS04StateMachine(parent(undefined, { contractVersion: 'forged-version' })).reasons, ['unsupported_audit_envelope_version']);
assert.deepEqual(validateS04StateMachine(parent(undefined, { stateTransitionAuthorized: true })).reasons, ['state_machine_parent_authorization_smuggling_forbidden']);
assert.deepEqual(validateS04StateMachine(parent([])).reasons, ['missing_audit_envelopes']);
assert.deepEqual(validateS04StateMachine(parent([audit({ auditEnvelopeId: 'AU:FORGED' })])).reasons, ['audit_envelope_identity_mismatch']);
assert.deepEqual(validateS04StateMachine(parent([audit({ eventId: '' })])).reasons, ['missing_state_machine_lineage_or_proof']);
assert.deepEqual(validateS04StateMachine(parent([audit({ resultStatus: 'unknown' })])).reasons, ['invalid_state_machine_result_status']);
assert.deepEqual(validateS04StateMachine(parent([audit({ auditState: 'claimed_ready' })])).reasons, ['audit_envelope_not_read_only_ready']);
assert.deepEqual(validateS04StateMachine(parent([audit({ dispatchAuthorized: true })])).reasons, ['state_machine_authorization_smuggling_forbidden']);
assert.deepEqual(validateS04StateMachine(parent([audit({ proposedState: 'completed' })])).reasons, ['preloaded_state_machine_result_forbidden']);
assert.deepEqual(
  validateS04StateMachine(parent([audit(), audit({ priorityRank: 2 })])).reasons,
  ['duplicate_audit_envelope'],
);

for (const [resultStatus, proposedState] of [['succeeded', 'completed'], ['failed', 'failed'], ['no_change', 'no_change']]) {
  const result = validateS04StateMachine(parent([audit({ resultStatus })]));
  assert.equal(result.transitionValidations[0].proposedState, proposedState);
  assert.equal(result.transitionValidations[0].stateTransitionAuthorized, false);
}

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_STATE_MACHINE_VALIDATION_VERSION,
  happyPath: happy.nextAction,
  failClosedCaseCount: 11,
}, null, 2));
