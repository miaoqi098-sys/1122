import assert from 'node:assert/strict';
import {
  buildS04PriorityCandidate,
  S04_PRIORITY_CONTRACT_VERSION,
} from '../s04-priority.js';

const decisionItem = {
  decision_item_id: 'DI:EVT-1:01',
  item_type: 'problem',
  goal_layer: 'business_quality',
  severity: 'P2',
  urgency: 'medium',
  evidence_strength: 'medium',
  dependency_count: 0,
  created_at: '2026-09-02T00:00:00.000Z',
};

const readyRuntime = {
  status: 'ready',
  eligible: true,
  nextAction: 'continue_to_S04',
  decisionItemId: 'DI:EVT-1:01',
  eventId: 'EVT-1',
  builderRunId: 'BR-1',
  conflictRunId: 'CR-1',
  decisionItem,
};

const blocked = buildS04PriorityCandidate({
  ...readyRuntime,
  status: 'blocked',
  eligible: false,
  nextAction: 'hold_for_review',
});
assert.equal(blocked.rankingEligible, false);
assert.equal(blocked.nextAction, 'hold_for_review');
assert.deepEqual(blocked.reasons, ['s04_runtime_not_ready']);

const forgedItemOnly = buildS04PriorityCandidate({ decisionItem });
assert.equal(forgedItemOnly.rankingEligible, false);
assert.deepEqual(forgedItemOnly.reasons, ['s04_runtime_not_ready']);

const identityMismatch = buildS04PriorityCandidate({
  ...readyRuntime,
  decisionItem: { ...decisionItem, decision_item_id: 'DI:FORGED:01' },
});
assert.equal(identityMismatch.rankingEligible, false);
assert.deepEqual(identityMismatch.reasons, ['decision_item_identity_mismatch']);

const invalidCreatedAt = buildS04PriorityCandidate({
  ...readyRuntime,
  decisionItem: { ...decisionItem, created_at: 'not-a-date' },
});
assert.equal(invalidCreatedAt.rankingEligible, false);
assert.deepEqual(invalidCreatedAt.reasons, ['invalid_decision_item_created_at']);

const invalidDependency = buildS04PriorityCandidate({
  ...readyRuntime,
  decisionItem: { ...decisionItem, dependency_count: -1 },
});
assert.equal(invalidDependency.rankingEligible, false);
assert.deepEqual(invalidDependency.reasons, ['invalid_decision_item_dependency_count']);

const missingSignal = buildS04PriorityCandidate({
  ...readyRuntime,
  decisionItem: { ...decisionItem, urgency: '' },
});
assert.equal(missingSignal.rankingEligible, false);
assert.deepEqual(missingSignal.reasons, ['missing_priority_signal_urgency']);

const candidate = buildS04PriorityCandidate(readyRuntime);
assert.equal(candidate.contractVersion, S04_PRIORITY_CONTRACT_VERSION);
assert.equal(candidate.status, 'candidate_ready');
assert.equal(candidate.rankingEligible, true);
assert.equal(candidate.nextAction, 'continue_to_priority_policy');
assert.equal(candidate.decisionItemId, 'DI:EVT-1:01');
assert.equal(candidate.signals.goalLayer, 'business_quality');
assert.equal(candidate.signals.severity, 'P2');
assert.equal(candidate.signals.urgency, 'medium');
assert.equal(candidate.signals.evidenceStrength, 'medium');
assert.equal(candidate.signals.dependencyCount, 0);
assert.equal(candidate.signals.createdAtMs, Date.parse(decisionItem.created_at));

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_PRIORITY_CONTRACT_VERSION,
  happyPath: candidate.nextAction,
  failClosedCases: [
    'runtime not ready',
    'forged decision item without runtime authority',
    'identity mismatch',
    'invalid created_at',
    'invalid dependency count',
    'missing normalized priority signal',
  ],
}, null, 2));
