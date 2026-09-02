import assert from 'node:assert/strict';
import { S04_DISPATCH_ENVELOPE_VERSION } from '../s04-dispatch-envelope.js';
import { createS04ExecutionResultContracts, S04_EXECUTION_RESULT_VERSION } from '../s04-execution-result.js';

const envelope = (overrides = {}) => ({
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
  envelopeState: 'planned_read_only',
  routingMode: 'unassigned',
  deliveryIntent: 'none',
  readOnly: true,
  dispatchAuthorized: false,
  executionAuthorized: false,
  ...overrides,
});

const result = (items = [envelope()], overrides = {}) => ({
  status: 'dispatch_envelopes_ready',
  dispatchPlanningEligible: true,
  nextAction: 'continue_to_execution_result_contract',
  dispatchEnvelopes: items,
  dispatchAuthorized: false,
  executionAuthorized: false,
  reasons: [],
  contractVersion: S04_DISPATCH_ENVELOPE_VERSION,
  ...overrides,
});

const happy = createS04ExecutionResultContracts(result());
assert.equal(happy.contractVersion, S04_EXECUTION_RESULT_VERSION);
assert.equal(happy.status, 'execution_result_contracts_ready');
assert.equal(happy.executionResultIntakeEligible, true);
assert.equal(happy.nextAction, 'continue_to_execution_result_verification');
assert.equal(happy.resultAccepted, false);
assert.equal(happy.dispatchAuthorized, false);
assert.equal(happy.executionAuthorized, false);
assert.equal(happy.executionResultContracts.length, 1);
assert.equal(happy.executionResultContracts[0].resultState, 'awaiting_trusted_executor_attestation');
assert.equal(happy.executionResultContracts[0].acceptanceMode, 'verified_only');
assert.equal(happy.executionResultContracts[0].resultAccepted, false);
assert.equal(happy.executionResultContracts[0].readOnly, true);
assert.equal(happy.executionResultContracts[0].dispatchAuthorized, false);
assert.equal(happy.executionResultContracts[0].executionAuthorized, false);

assert.deepEqual(createS04ExecutionResultContracts(result(undefined, { status: 'blocked' })).reasons, ['dispatch_envelopes_not_released']);
assert.deepEqual(createS04ExecutionResultContracts(result(undefined, { contractVersion: 'forged-version' })).reasons, ['unsupported_dispatch_envelope_version']);
assert.deepEqual(createS04ExecutionResultContracts(result(undefined, { dispatchAuthorized: true })).reasons, ['dispatch_envelope_authorization_smuggling_forbidden']);
assert.deepEqual(createS04ExecutionResultContracts(result(undefined, { executionResult: { status: 'success' } })).reasons, ['preloaded_execution_result_forbidden']);
assert.deepEqual(createS04ExecutionResultContracts(result([])).reasons, ['missing_dispatch_envelopes']);
assert.deepEqual(createS04ExecutionResultContracts(result([envelope({ envelopeState: 'dispatched' })])).reasons, ['execution_result_envelope_not_planned_read_only']);
assert.deepEqual(createS04ExecutionResultContracts(result([envelope({ routingMode: 'amazon_prod' })])).reasons, ['execution_result_routing_must_be_unassigned']);
assert.deepEqual(createS04ExecutionResultContracts(result([envelope({ deliveryIntent: 'send' })])).reasons, ['execution_result_delivery_intent_must_be_none']);
assert.deepEqual(createS04ExecutionResultContracts(result([envelope({ readOnly: false })])).reasons, ['execution_result_envelope_not_read_only']);
assert.deepEqual(createS04ExecutionResultContracts(result([envelope({ dispatchAuthorized: true })])).reasons, ['execution_result_dispatch_authorization_smuggling_forbidden']);
assert.deepEqual(createS04ExecutionResultContracts(result([envelope({ executionAuthorized: true })])).reasons, ['execution_result_authorization_smuggling_forbidden']);
assert.deepEqual(createS04ExecutionResultContracts(result([envelope({ dispatchEnvelopeId: 'DE:FORGED' })])).reasons, ['execution_result_dispatch_envelope_identity_mismatch']);
assert.deepEqual(createS04ExecutionResultContracts(result([envelope({ priorityRank: 2 })])).reasons, ['invalid_execution_result_priority_rank']);
assert.deepEqual(
  createS04ExecutionResultContracts(result([envelope(), { ...envelope(), priorityRank: 2 }])).reasons,
  ['duplicate_dispatch_envelope'],
);

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_EXECUTION_RESULT_VERSION,
  happyPath: happy.nextAction,
  failClosedCaseCount: 14,
}, null, 2));
