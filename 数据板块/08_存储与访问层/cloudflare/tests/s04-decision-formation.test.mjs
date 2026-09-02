import assert from 'node:assert/strict';
import { S04_PRIORITY_POLICY_VERSION } from '../s04-priority-policy.js';
import {
  formS04DecisionCandidates,
  S04_DECISION_FORMATION_VERSION,
} from '../s04-decision-formation.js';

const rankedItem = (overrides = {}) => ({
  rank: 1,
  decisionItemId: 'DI:EVT-1:01',
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
  ...overrides,
});

const released = (items = [rankedItem()], overrides = {}) => ({
  status: 'ranking_ready',
  rankingEligible: true,
  nextAction: 'continue_to_decision_formation',
  rankedDecisionItems: items,
  reasons: [],
  policyVersion: S04_PRIORITY_POLICY_VERSION,
  ...overrides,
});

const happy = formS04DecisionCandidates(released());
assert.equal(happy.contractVersion, S04_DECISION_FORMATION_VERSION);
assert.equal(happy.status, 'formation_ready');
assert.equal(happy.formationEligible, true);
assert.equal(happy.nextAction, 'continue_to_task_draft_generation');
assert.equal(happy.decisionCandidates.length, 1);
assert.equal(happy.decisionCandidates[0].decisionCandidateId, 'DC:DI:EVT-1:01');
assert.equal(happy.decisionCandidates[0].decisionState, 'candidate');
assert.equal(happy.decisionCandidates[0].readOnly, true);
assert.equal(happy.decisionCandidates[0].executionAuthorized, false);
assert.equal(happy.decisionCandidates[0].taskGenerationMode, 'draft_only');

const notReleased = formS04DecisionCandidates(released([], { status: 'blocked' }));
assert.equal(notReleased.formationEligible, false);
assert.deepEqual(notReleased.reasons, ['priority_result_not_released']);

const wrongPolicy = formS04DecisionCandidates(released(undefined, { policyVersion: 'forged-policy' }));
assert.equal(wrongPolicy.formationEligible, false);
assert.deepEqual(wrongPolicy.reasons, ['unsupported_priority_policy_version']);

const missingItems = formS04DecisionCandidates(released([]));
assert.equal(missingItems.formationEligible, false);
assert.deepEqual(missingItems.reasons, ['missing_ranked_decision_items']);

const rankGap = formS04DecisionCandidates(released([
  rankedItem(),
  rankedItem({ rank: 3, decisionItemId: 'DI:EVT-2:01', eventId: 'EVT-2', builderRunId: 'BR-2', conflictRunId: 'CR-2' }),
]));
assert.equal(rankGap.formationEligible, false);
assert.deepEqual(rankGap.reasons, ['invalid_decision_priority_rank']);

const duplicate = formS04DecisionCandidates(released([
  rankedItem(),
  rankedItem({ rank: 2 }),
]));
assert.equal(duplicate.formationEligible, false);
assert.deepEqual(duplicate.reasons, ['duplicate_decision_item']);

const missingLineage = formS04DecisionCandidates(released([rankedItem({ builderRunId: '' })]));
assert.equal(missingLineage.formationEligible, false);
assert.deepEqual(missingLineage.reasons, ['missing_decision_builder_run_id']);

const invalidDependency = formS04DecisionCandidates(released([
  rankedItem({ signals: { ...rankedItem().signals, dependencyCount: -1 } }),
]));
assert.equal(invalidDependency.formationEligible, false);
assert.deepEqual(invalidDependency.reasons, ['invalid_decision_dependency_count']);

const forgedExecution = formS04DecisionCandidates(released([
  rankedItem({ executionAuthorized: true, taskGenerationMode: 'execute_now' }),
]));
assert.equal(forgedExecution.formationEligible, true);
assert.equal(forgedExecution.decisionCandidates[0].executionAuthorized, false);
assert.equal(forgedExecution.decisionCandidates[0].taskGenerationMode, 'draft_only');
assert.equal('executionAuthorized' in rankedItem(), false);

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_DECISION_FORMATION_VERSION,
  happyPath: happy.nextAction,
  failClosedCases: [
    'priority result not released',
    'unsupported priority policy version',
    'missing ranked decision items',
    'non-contiguous priority rank',
    'duplicate decision item',
    'missing lineage',
    'invalid dependency count',
    'forged execution flags ignored',
  ],
}, null, 2));
