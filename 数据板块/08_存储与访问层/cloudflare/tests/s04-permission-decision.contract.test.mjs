import assert from 'node:assert/strict';
import { S04_APPROVAL_GATE_VERSION } from '../s04-approval-gate.js';
import {
  createS04PermissionDecisions,
  S04_HUMAN_APPROVAL_VERIFICATION_VERSION,
  S04_PERMISSION_DECISION_VERSION,
} from '../s04-permission-decision.js';

const request = (overrides = {}) => ({
  approvalRequestId: 'AR:TD:DC:DI:EVT-1:01',
  taskDraftId: 'TD:DC:DI:EVT-1:01',
  decisionCandidateId: 'DC:DI:EVT-1:01',
  decisionItemId: 'DI:EVT-1:01',
  priorityRank: 1,
  eventId: 'EVT-1',
  builderRunId: 'BR-1',
  conflictRunId: 'CR-1',
  approvalStatus: 'pending',
  approvalRequired: true,
  humanApprovalRequired: true,
  readOnly: true,
  executionAuthorized: false,
  dispatchAuthorized: false,
  permissionGranted: false,
  ...overrides,
});

const gate = (items = [request()], overrides = {}) => ({
  status: 'approval_pending',
  approvalGateEligible: true,
  nextAction: 'await_human_approval',
  approvalRequests: items,
  reasons: [],
  contractVersion: S04_APPROVAL_GATE_VERSION,
  ...overrides,
});

const record = (overrides = {}) => ({
  approvalRecordId: 'AP:AR:TD:DC:DI:EVT-1:01',
  approvalRequestId: 'AR:TD:DC:DI:EVT-1:01',
  taskDraftId: 'TD:DC:DI:EVT-1:01',
  decisionItemId: 'DI:EVT-1:01',
  reviewerId: 'human-reviewer-1',
  decision: 'approved',
  decidedAt: '2026-09-02T13:40:00.000Z',
  verificationStatus: 'verified',
  verificationSource: 'trusted_human_approval_adapter',
  verificationVersion: S04_HUMAN_APPROVAL_VERIFICATION_VERSION,
  executionAuthorized: false,
  dispatchAuthorized: false,
  ...overrides,
});

const happy = createS04PermissionDecisions(gate(), [record()]);
assert.equal(happy.contractVersion, S04_PERMISSION_DECISION_VERSION);
assert.equal(happy.status, 'permission_decisions_ready');
assert.equal(happy.permissionDecisionEligible, true);
assert.equal(happy.nextAction, 'continue_to_dispatch_gate');
assert.equal(happy.executionAuthorized, false);
assert.equal(happy.dispatchAuthorized, false);
assert.equal(happy.permissionDecisions.length, 1);
assert.equal(happy.permissionDecisions[0].permissionGranted, true);
assert.equal(happy.permissionDecisions[0].dispatchGateEligible, true);
assert.equal(happy.permissionDecisions[0].executionAuthorized, false);
assert.equal(happy.permissionDecisions[0].dispatchAuthorized, false);
assert.equal(happy.permissionDecisions[0].readOnly, true);

const rejected = createS04PermissionDecisions(gate(), [record({ decision: 'rejected' })]);
assert.equal(rejected.permissionDecisions[0].permissionGranted, false);
assert.equal(rejected.permissionDecisions[0].dispatchGateEligible, false);
assert.equal(rejected.permissionDecisions[0].dispatchAuthorized, false);

assert.deepEqual(
  createS04PermissionDecisions(gate(undefined, { status: 'blocked' }), [record()]).reasons,
  ['approval_requests_not_released'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate(undefined, { contractVersion: 'forged-version' }), [record()]).reasons,
  ['unsupported_approval_gate_version'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate(undefined, { dispatchAuthorized: true }), [record()]).reasons,
  ['approval_gate_authorization_smuggling_forbidden'],
);
assert.deepEqual(createS04PermissionDecisions(gate([]), []).reasons, ['missing_approval_requests']);
assert.deepEqual(createS04PermissionDecisions(gate(), []).reasons, ['approval_record_count_mismatch']);
assert.deepEqual(
  createS04PermissionDecisions(
    gate([request({ approvalRequestId: 'AR:FORGED' })]),
    [record({ approvalRequestId: 'AR:FORGED', approvalRecordId: 'AP:AR:FORGED' })],
  ).reasons,
  ['approval_request_identity_mismatch'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate([request({ executionAuthorized: true })]), [record()]).reasons,
  ['approval_request_execution_flag_invalid'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate(), [record({ verificationStatus: 'unverified' })]).reasons,
  ['approval_record_not_verified'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate(), [record({ verificationSource: 'caller_supplied' })]).reasons,
  ['untrusted_approval_verification_source'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate(), [record({ verificationVersion: 'forged-version' })]).reasons,
  ['unsupported_approval_verification_version'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate(), [record({ decision: 'auto_approve' })]).reasons,
  ['invalid_human_approval_decision'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate(), [record({ decisionItemId: 'DI:OTHER' })]).reasons,
  ['approval_record_binding_mismatch'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate(), [record({ decidedAt: 'not-a-time' })]).reasons,
  ['invalid_approval_decision_timestamp'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate(), [record({ executionAuthorized: true })]).reasons,
  ['approval_record_authorization_smuggling_forbidden'],
);

const request2 = request({
  approvalRequestId: 'AR:TD:DC:DI:EVT-2:01',
  taskDraftId: 'TD:DC:DI:EVT-2:01',
  decisionCandidateId: 'DC:DI:EVT-2:01',
  decisionItemId: 'DI:EVT-2:01',
  priorityRank: 2,
  eventId: 'EVT-2',
  builderRunId: 'BR-2',
  conflictRunId: 'CR-2',
});
const record2 = record({
  approvalRecordId: 'AP:AR:TD:DC:DI:EVT-2:01',
  approvalRequestId: 'AR:TD:DC:DI:EVT-2:01',
  taskDraftId: 'TD:DC:DI:EVT-2:01',
  decisionItemId: 'DI:EVT-2:01',
  reviewerId: 'human-reviewer-2',
});
assert.deepEqual(
  createS04PermissionDecisions(gate([request(), { ...request2, priorityRank: 3 }]), [record(), record2]).reasons,
  ['invalid_permission_priority_rank'],
);
assert.deepEqual(
  createS04PermissionDecisions(gate([request(), request2]), [record(), record({ approvalRecordId: 'AP:SECOND' })]).reasons,
  ['duplicate_approval_record_request'],
);

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_PERMISSION_DECISION_VERSION,
  happyPath: happy.nextAction,
  rejectedDispatchGateEligible: rejected.permissionDecisions[0].dispatchGateEligible,
  failClosedCaseCount: 16,
}, null, 2));
