import assert from 'node:assert/strict';
import { S04_DECISION_FORMATION_VERSION } from '../s04-decision-formation.js';
import {
  generateS04TaskDrafts,
  S04_TASK_DRAFT_VERSION,
} from '../s04-task-draft.js';

const candidate = (overrides = {}) => ({
  decisionCandidateId: 'DC:DI:EVT-1:01',
  decisionItemId: 'DI:EVT-1:01',
  priorityRank: 1,
  eventId: 'EVT-1',
  builderRunId: 'BR-1',
  conflictRunId: 'CR-1',
  signals: {
    goalLayer: 'business_quality',
    urgency: 'high',
    severity: 'P1',
    evidenceStrength: 'high',
    dependencyCount: 0,
    createdAtMs: Date.parse('2026-09-02T00:00:00.000Z'),
  },
  decisionState: 'candidate',
  readOnly: true,
  executionAuthorized: false,
  taskGenerationMode: 'draft_only',
  ...overrides,
});

const released = (items = [candidate()], overrides = {}) => ({
  status: 'formation_ready',
  formationEligible: true,
  nextAction: 'continue_to_task_draft_generation',
  decisionCandidates: items,
  reasons: [],
  contractVersion: S04_DECISION_FORMATION_VERSION,
  ...overrides,
});

const happy = generateS04TaskDrafts(released());
assert.equal(happy.contractVersion, S04_TASK_DRAFT_VERSION);
assert.equal(happy.status, 'task_drafts_ready');
assert.equal(happy.taskDraftEligible, true);
assert.equal(happy.nextAction, 'continue_to_approval_gate');
assert.equal(happy.taskDrafts.length, 1);
assert.equal(happy.taskDrafts[0].taskDraftId, 'TD:DC:DI:EVT-1:01');
assert.equal(happy.taskDrafts[0].taskState, 'draft');
assert.equal(happy.taskDrafts[0].draftOnly, true);
assert.equal(happy.taskDrafts[0].readOnly, true);
assert.equal(happy.taskDrafts[0].executionAuthorized, false);
assert.equal(happy.taskDrafts[0].approvalRequired, true);
assert.equal(happy.taskDrafts[0].dispatchAuthorized, false);

const notReleased = generateS04TaskDrafts(released([], { status: 'blocked' }));
assert.equal(notReleased.taskDraftEligible, false);
assert.deepEqual(notReleased.reasons, ['decision_formation_not_released']);

const wrongVersion = generateS04TaskDrafts(released(undefined, { contractVersion: 'forged-version' }));
assert.equal(wrongVersion.taskDraftEligible, false);
assert.deepEqual(wrongVersion.reasons, ['unsupported_decision_formation_version']);

const missingCandidates = generateS04TaskDrafts(released([]));
assert.equal(missingCandidates.taskDraftEligible, false);
assert.deepEqual(missingCandidates.reasons, ['missing_decision_candidates']);

const forgedIdentity = generateS04TaskDrafts(released([
  candidate({ decisionCandidateId: 'DC:DI:FORGED:01' }),
]));
assert.equal(forgedIdentity.taskDraftEligible, false);
assert.deepEqual(forgedIdentity.reasons, ['decision_candidate_identity_mismatch']);

const rankGap = generateS04TaskDrafts(released([
  candidate(),
  candidate({
    decisionCandidateId: 'DC:DI:EVT-2:01',
    decisionItemId: 'DI:EVT-2:01',
    priorityRank: 3,
    eventId: 'EVT-2',
    builderRunId: 'BR-2',
    conflictRunId: 'CR-2',
  }),
]));
assert.equal(rankGap.taskDraftEligible, false);
assert.deepEqual(rankGap.reasons, ['invalid_task_draft_priority_rank']);

const missingLineage = generateS04TaskDrafts(released([
  candidate({ conflictRunId: '' }),
]));
assert.equal(missingLineage.taskDraftEligible, false);
assert.deepEqual(missingLineage.reasons, ['missing_task_draft_conflict_run_id']);

const executionCapable = generateS04TaskDrafts(released([
  candidate({ executionAuthorized: true }),
]));
assert.equal(executionCapable.taskDraftEligible, false);
assert.deepEqual(executionCapable.reasons, ['decision_candidate_execution_flag_invalid']);

const forgedMode = generateS04TaskDrafts(released([
  candidate({ taskGenerationMode: 'execute_now' }),
]));
assert.equal(forgedMode.taskDraftEligible, false);
assert.deepEqual(forgedMode.reasons, ['decision_candidate_task_mode_invalid']);

const duplicate = generateS04TaskDrafts(released([
  candidate(),
  candidate({ priorityRank: 2 }),
]));
assert.equal(duplicate.taskDraftEligible, false);
assert.deepEqual(duplicate.reasons, ['duplicate_decision_candidate']);

const invalidSignals = generateS04TaskDrafts(released([
  candidate({ signals: { ...candidate().signals, dependencyCount: -1 } }),
]));
assert.equal(invalidSignals.taskDraftEligible, false);
assert.deepEqual(invalidSignals.reasons, ['invalid_task_draft_dependency_count']);

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_TASK_DRAFT_VERSION,
  happyPath: happy.nextAction,
  failClosedCases: [
    'decision formation not released',
    'unsupported decision formation version',
    'missing decision candidates',
    'forged candidate identity',
    'non-contiguous priority rank',
    'missing lineage',
    'execution-capable candidate',
    'forged task generation mode',
    'duplicate candidate',
    'invalid task signals',
  ],
}, null, 2));
