import assert from 'node:assert/strict';
import { S04_DISPATCH_GATE_VERSION } from '../s04-dispatch-gate.js';
import { createS04DispatchEnvelopes, S04_DISPATCH_ENVELOPE_VERSION } from '../s04-dispatch-envelope.js';

const candidate = (overrides = {}) => ({
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
  dispatchState: 'candidate_only',
  readOnly: true,
  dispatchAuthorized: false,
  executionAuthorized: false,
  ...overrides,
});

const result = (items = [candidate()], overrides = {}) => ({
  status: 'dispatch_candidates_ready',
  dispatchGateEligible: true,
  nextAction: 'continue_to_dispatch_planning',
  dispatchCandidates: items,
  dispatchAuthorized: false,
  executionAuthorized: false,
  contractVersion: S04_DISPATCH_GATE_VERSION,
  ...overrides,
});

const happy = createS04DispatchEnvelopes(result());
assert.equal(happy.contractVersion, S04_DISPATCH_ENVELOPE_VERSION);
assert.equal(happy.status, 'dispatch_envelopes_ready');
assert.equal(happy.dispatchPlanningEligible, true);
assert.equal(happy.nextAction, 'continue_to_execution_result_contract');
assert.equal(happy.dispatchAuthorized, false);
assert.equal(happy.executionAuthorized, false);
assert.equal(happy.dispatchEnvelopes.length, 1);
assert.equal(happy.dispatchEnvelopes[0].envelopeState, 'planned_read_only');
assert.equal(happy.dispatchEnvelopes[0].routingMode, 'unassigned');
assert.equal(happy.dispatchEnvelopes[0].deliveryIntent, 'none');
assert.equal(happy.dispatchEnvelopes[0].readOnly, true);
assert.equal(happy.dispatchEnvelopes[0].dispatchAuthorized, false);
assert.equal(happy.dispatchEnvelopes[0].executionAuthorized, false);

assert.deepEqual(createS04DispatchEnvelopes(result(undefined, { status: 'blocked' })).reasons, ['dispatch_candidates_not_released']);
assert.deepEqual(createS04DispatchEnvelopes(result(undefined, { contractVersion: 'forged-version' })).reasons, ['unsupported_dispatch_gate_version']);
assert.deepEqual(createS04DispatchEnvelopes(result(undefined, { dispatchAuthorized: true })).reasons, ['dispatch_gate_authorization_smuggling_forbidden']);
assert.deepEqual(createS04DispatchEnvelopes(result([])).reasons, ['missing_dispatch_candidates']);
assert.deepEqual(createS04DispatchEnvelopes(result([candidate({ dispatchState: 'dispatched' })])).reasons, ['dispatch_candidate_not_candidate_only']);
assert.deepEqual(createS04DispatchEnvelopes(result([candidate({ readOnly: false })])).reasons, ['dispatch_candidate_not_read_only']);
assert.deepEqual(createS04DispatchEnvelopes(result([candidate({ dispatchAuthorized: true })])).reasons, ['dispatch_authorization_smuggling_forbidden']);
assert.deepEqual(createS04DispatchEnvelopes(result([candidate({ executionAuthorized: true })])).reasons, ['execution_authorization_smuggling_forbidden']);
assert.deepEqual(createS04DispatchEnvelopes(result([candidate({ dispatchCandidateId: 'DG:FORGED' })])).reasons, ['dispatch_candidate_identity_mismatch']);
assert.deepEqual(createS04DispatchEnvelopes(result([candidate({ priorityRank: 2 })])).reasons, ['invalid_dispatch_envelope_priority_rank']);

assert.deepEqual(
  createS04DispatchEnvelopes(result([candidate(), { ...candidate(), priorityRank: 2 }])).reasons,
  ['duplicate_dispatch_candidate'],
);

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_DISPATCH_ENVELOPE_VERSION,
  happyPath: happy.nextAction,
  failClosedCaseCount: 11,
}, null, 2));
