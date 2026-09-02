import assert from 'node:assert/strict';
import { S04_PERMISSION_DECISION_VERSION } from '../s04-permission-decision.js';
import { createS04DispatchCandidates, S04_DISPATCH_GATE_VERSION } from '../s04-dispatch-gate.js';

const decision = (overrides = {}) => ({
  permissionDecisionId: 'PD:AR:TD:DC:DI:EVT-1:01',
  approvalRequestId: 'AR:TD:DC:DI:EVT-1:01',
  taskDraftId: 'TD:DC:DI:EVT-1:01',
  decisionCandidateId: 'DC:DI:EVT-1:01',
  decisionItemId: 'DI:EVT-1:01',
  priorityRank: 1,
  eventId: 'EVT-1',
  builderRunId: 'BR-1',
  conflictRunId: 'CR-1',
  permissionGranted: true,
  dispatchGateEligible: true,
  readOnly: true,
  dispatchAuthorized: false,
  executionAuthorized: false,
  ...overrides,
});

const result = (items = [decision()], overrides = {}) => ({
  status: 'permission_decisions_ready',
  permissionDecisionEligible: true,
  nextAction: 'continue_to_dispatch_gate',
  permissionDecisions: items,
  dispatchAuthorized: false,
  executionAuthorized: false,
  contractVersion: S04_PERMISSION_DECISION_VERSION,
  ...overrides,
});

const happy = createS04DispatchCandidates(result());
assert.equal(happy.contractVersion, S04_DISPATCH_GATE_VERSION);
assert.equal(happy.status, 'dispatch_candidates_ready');
assert.equal(happy.dispatchGateEligible, true);
assert.equal(happy.nextAction, 'continue_to_dispatch_planning');
assert.equal(happy.dispatchAuthorized, false);
assert.equal(happy.executionAuthorized, false);
assert.equal(happy.dispatchCandidates.length, 1);
assert.equal(happy.dispatchCandidates[0].dispatchState, 'candidate_only');
assert.equal(happy.dispatchCandidates[0].readOnly, true);
assert.equal(happy.dispatchCandidates[0].dispatchAuthorized, false);
assert.equal(happy.dispatchCandidates[0].executionAuthorized, false);

assert.deepEqual(createS04DispatchCandidates(result(undefined, { status: 'blocked' })).reasons, ['permission_decisions_not_released']);
assert.deepEqual(createS04DispatchCandidates(result(undefined, { contractVersion: 'forged-version' })).reasons, ['unsupported_permission_decision_version']);
assert.deepEqual(createS04DispatchCandidates(result(undefined, { dispatchAuthorized: true })).reasons, ['permission_result_authorization_smuggling_forbidden']);
assert.deepEqual(createS04DispatchCandidates(result([])).reasons, ['missing_permission_decisions']);
assert.deepEqual(createS04DispatchCandidates(result([decision({ permissionGranted: false })])).reasons, ['permission_not_granted']);
assert.deepEqual(createS04DispatchCandidates(result([decision({ dispatchGateEligible: false })])).reasons, ['permission_not_dispatch_gate_eligible']);
assert.deepEqual(createS04DispatchCandidates(result([decision({ dispatchAuthorized: true })])).reasons, ['dispatch_authorization_smuggling_forbidden']);
assert.deepEqual(createS04DispatchCandidates(result([decision({ executionAuthorized: true })])).reasons, ['execution_authorization_smuggling_forbidden']);
assert.deepEqual(createS04DispatchCandidates(result([decision({ permissionDecisionId: 'PD:FORGED' })])).reasons, ['dispatch_permission_decision_identity_mismatch']);
assert.deepEqual(createS04DispatchCandidates(result([decision({ priorityRank: 2 })])).reasons, ['invalid_dispatch_priority_rank']);

const second = decision({
  permissionDecisionId: 'PD:AR:TD:DC:DI:EVT-2:01',
  approvalRequestId: 'AR:TD:DC:DI:EVT-2:01',
  taskDraftId: 'TD:DC:DI:EVT-2:01',
  decisionCandidateId: 'DC:DI:EVT-2:01',
  decisionItemId: 'DI:EVT-2:01',
  priorityRank: 2,
  eventId: 'EVT-2',
  builderRunId: 'BR-2',
  conflictRunId: 'CR-2',
});
assert.deepEqual(
  createS04DispatchCandidates(result([decision(), { ...second, permissionDecisionId: decision().permissionDecisionId }])).reasons,
  ['dispatch_permission_decision_identity_mismatch'],
);
assert.deepEqual(
  createS04DispatchCandidates(result([decision(), { ...decision(), priorityRank: 2 }])).reasons,
  ['duplicate_permission_decision'],
);

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_DISPATCH_GATE_VERSION,
  happyPath: happy.nextAction,
  failClosedCaseCount: 12,
}, null, 2));
