import assert from 'node:assert/strict';
import {
  rankS04PriorityCandidates,
  S04_PRIORITY_POLICY_VERSION,
} from '../s04-priority-policy.js';

function candidate(id, overrides = {}) {
  return {
    status: 'candidate_ready',
    rankingEligible: true,
    nextAction: 'continue_to_priority_policy',
    decisionItemId: id,
    eventId: `EVT-${id}`,
    builderRunId: `BR-${id}`,
    conflictRunId: `CR-${id}`,
    signals: {
      goalLayer: 'business_quality',
      urgency: 'medium',
      severity: 'P2',
      evidenceStrength: 'medium',
      dependencyCount: 0,
      createdAtMs: Date.parse('2026-09-02T00:00:00.000Z'),
      ...overrides,
    },
  };
}

const empty = rankS04PriorityCandidates([]);
assert.equal(empty.rankingEligible, false);
assert.equal(empty.nextAction, 'hold_for_review');
assert.deepEqual(empty.reasons, ['missing_priority_candidates']);

const forged = rankS04PriorityCandidates([
  { decisionItemId: 'DI-FORGED', signals: {} },
]);
assert.equal(forged.rankingEligible, false);
assert.deepEqual(forged.reasons, ['priority_candidate_not_ready']);

const unsupported = rankS04PriorityCandidates([
  candidate('DI-1', { urgency: 'execute_now' }),
]);
assert.equal(unsupported.rankingEligible, false);
assert.deepEqual(unsupported.reasons, ['unsupported_priority_urgency']);

const duplicate = rankS04PriorityCandidates([
  candidate('DI-1'),
  candidate('DI-1'),
]);
assert.equal(duplicate.rankingEligible, false);
assert.deepEqual(duplicate.reasons, ['duplicate_priority_candidate']);

const ranking = rankS04PriorityCandidates([
  candidate('DI-growth', { goalLayer: 'growth_expansion', urgency: 'immediate', severity: 'P0' }),
  candidate('DI-safety-low', { goalLayer: 'safety_sellability', urgency: 'low', severity: 'P3' }),
  candidate('DI-survival', { goalLayer: 'survival_operations', urgency: 'medium', severity: 'P2' }),
  candidate('DI-safety-high', { goalLayer: 'safety_sellability', urgency: 'high', severity: 'P2' }),
]);
assert.equal(ranking.policyVersion, S04_PRIORITY_POLICY_VERSION);
assert.equal(ranking.status, 'ranking_ready');
assert.equal(ranking.rankingEligible, true);
assert.equal(ranking.nextAction, 'continue_to_decision_formation');
assert.deepEqual(
  ranking.rankedDecisionItems.map((item) => item.decisionItemId),
  ['DI-safety-high', 'DI-safety-low', 'DI-survival', 'DI-growth'],
);

const dependencyOrdering = rankS04PriorityCandidates([
  candidate('DI-blocked', { dependencyCount: 2 }),
  candidate('DI-clear', { dependencyCount: 0 }),
]);
assert.deepEqual(
  dependencyOrdering.rankedDecisionItems.map((item) => item.decisionItemId),
  ['DI-clear', 'DI-blocked'],
);

const deterministicTie = rankS04PriorityCandidates([
  candidate('DI-B'),
  candidate('DI-A'),
]);
assert.deepEqual(
  deterministicTie.rankedDecisionItems.map((item) => item.decisionItemId),
  ['DI-A', 'DI-B'],
);

console.log(JSON.stringify({
  success: true,
  policyVersion: S04_PRIORITY_POLICY_VERSION,
  happyPath: ranking.nextAction,
  failClosedCases: [
    'missing candidates',
    'forged/unvalidated candidate',
    'unsupported priority signal',
    'duplicate candidate identity',
  ],
  deterministicOrdering: [
    'goal layer',
    'urgency',
    'severity',
    'dependency readiness',
    'dependency count',
    'evidence strength',
    'created_at',
    'decision_item_id tie-break',
  ],
}, null, 2));
