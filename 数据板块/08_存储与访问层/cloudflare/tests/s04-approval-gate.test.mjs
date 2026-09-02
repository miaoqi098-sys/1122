import assert from 'node:assert/strict';
import { S04_TASK_DRAFT_VERSION } from '../s04-task-draft.js';
import {
  createS04ApprovalRequests,
  S04_APPROVAL_GATE_VERSION,
} from '../s04-approval-gate.js';

const draft = (overrides = {}) => ({
  taskDraftId: 'TD:DC:DI:EVT-1:01',
  decisionCandidateId: 'DC:DI:EVT-1:01',
  decisionItemId: 'DI:EVT-1:01',
  priorityRank: 1,
  eventId: 'EVT-1',
  builderRunId: 'BR-1',
  conflictRunId: 'CR-1',
  taskState: 'draft',
  draftOnly: true,
  readOnly: true,
  executionAuthorized: false,
  approvalRequired: true,
  dispatchAuthorized: false,
  ...overrides,
});

const released = (items = [draft()], overrides = {}) => ({
  status: 'task_drafts_ready',
  taskDraftEligible: true,
  nextAction: 'continue_to_approval_gate',
  taskDrafts: items,
  reasons: [],
  contractVersion: S04_TASK_DRAFT_VERSION,
  ...overrides,
});

const happy = createS04ApprovalRequests(released());
assert.equal(happy.contractVersion, S04_APPROVAL_GATE_VERSION);
assert.equal(happy.status, 'approval_pending');
assert.equal(happy.approvalGateEligible, true);
assert.equal(happy.nextAction, 'await_human_approval');
assert.equal(happy.approvalRequests.length, 1);
assert.equal(happy.approvalRequests[0].approvalRequestId, 'AR:TD:DC:DI:EVT-1:01');
assert.equal(happy.approvalRequests[0].approvalStatus, 'pending');
assert.equal(happy.approvalRequests[0].humanApprovalRequired, true);
assert.equal(happy.approvalRequests[0].executionAuthorized, false);
assert.equal(happy.approvalRequests[0].dispatchAuthorized, false);
assert.equal(happy.approvalRequests[0].permissionGranted, false);

const notReleased = createS04ApprovalRequests(released([], { status: 'blocked' }));
assert.deepEqual(notReleased.reasons, ['task_drafts_not_released']);

const wrongVersion = createS04ApprovalRequests(released(undefined, { contractVersion: 'forged-version' }));
assert.deepEqual(wrongVersion.reasons, ['unsupported_task_draft_version']);

const missingDrafts = createS04ApprovalRequests(released([]));
assert.deepEqual(missingDrafts.reasons, ['missing_task_drafts']);

const forgedIdentity = createS04ApprovalRequests(released([
  draft({ taskDraftId: 'TD:FORGED' }),
]));
assert.deepEqual(forgedIdentity.reasons, ['task_draft_identity_mismatch']);

const missingLineage = createS04ApprovalRequests(released([
  draft({ builderRunId: '' }),
]));
assert.deepEqual(missingLineage.reasons, ['missing_approval_lineage']);

const rankGap = createS04ApprovalRequests(released([
  draft(),
  draft({
    taskDraftId: 'TD:DC:DI:EVT-2:01',
    decisionCandidateId: 'DC:DI:EVT-2:01',
    decisionItemId: 'DI:EVT-2:01',
    priorityRank: 3,
    eventId: 'EVT-2',
    builderRunId: 'BR-2',
    conflictRunId: 'CR-2',
  }),
]));
assert.deepEqual(rankGap.reasons, ['invalid_approval_priority_rank']);

const executionCapable = createS04ApprovalRequests(released([
  draft({ executionAuthorized: true }),
]));
assert.deepEqual(executionCapable.reasons, ['task_execution_flag_invalid']);

const dispatchCapable = createS04ApprovalRequests(released([
  draft({ dispatchAuthorized: true }),
]));
assert.deepEqual(dispatchCapable.reasons, ['task_dispatch_flag_invalid']);

const selfApproved = createS04ApprovalRequests(released([
  draft({ approved: true, approvalStatus: 'approved', approvedBy: 'caller' }),
]));
assert.deepEqual(selfApproved.reasons, ['caller_supplied_approval_state_forbidden']);

const containerAuthorization = createS04ApprovalRequests(released(undefined, {
  permissionGranted: true,
}));
assert.deepEqual(containerAuthorization.reasons, ['upstream_authorization_state_forbidden']);

const duplicate = createS04ApprovalRequests(released([
  draft(),
  draft({ priorityRank: 2 }),
]));
assert.deepEqual(duplicate.reasons, ['duplicate_task_draft']);

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_APPROVAL_GATE_VERSION,
  happyPath: happy.nextAction,
  failClosedCases: [
    'task drafts not released',
    'unsupported task draft version',
    'missing task drafts',
    'forged task identity',
    'missing lineage',
    'non-contiguous priority rank',
    'execution-capable task',
    'dispatch-capable task',
    'caller self-approval',
    'container authorization smuggling',
    'duplicate task draft',
  ],
}, null, 2));
