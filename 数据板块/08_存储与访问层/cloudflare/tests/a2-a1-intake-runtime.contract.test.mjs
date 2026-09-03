import assert from 'node:assert/strict';
import { runAgent2ToA1Intake } from '../a2-a1-intake-runtime.js';

function snapshot(id, observedAt, availabilityState) {
  return {
    snapshot_id: id,
    scope_type: 'product',
    scope_id: 'PROD-1',
    observed_at: observedAt,
    source_refs: [`source:${id}`],
    domains: { availability_state: availabilityState },
    raw_facts: [`availability_state=${availabilityState}`],
    evidence_refs: [`evidence:${id}`],
    freshness: { status: 'fresh' },
    confidence: 0.95,
    metadata: { product_id: 'PROD-1', asin: 'B0TEST001' },
  };
}

const validInput = {
  input_mode: 'simulated',
  previous_snapshot: snapshot('A2-SNAP-1', '2026-09-03T02:00:00.000Z', 'active'),
  current_snapshot: {
    ...snapshot('A2-SNAP-2', '2026-09-03T02:05:00.000Z', 'suppressed'),
    previous_snapshot_id: 'A2-SNAP-1',
  },
};

const passed = runAgent2ToA1Intake(validInput, {
  receivedAt: '2026-09-03T02:05:10.000Z',
  mappedAt: '2026-09-03T02:05:11.000Z',
  currentTime: '2026-09-03T02:05:12.000Z',
});
assert.equal(passed.status, 'ready_for_S02');
assert.equal(passed.nextAction, 'continue_to_S02');
assert.equal(passed.readOnly, true);
assert.equal(passed.executionAuthorized, false);
assert.equal(passed.dispatchAuthorized, false);
assert.equal(passed.canonicalEvent.source_type, 'professional_agent');
assert.equal(passed.canonicalEvent.source_agent, 'Agent-2');
assert.equal(passed.canonicalEvent.product_id, 'PROD-1');
assert.ok(['passed', 'passed_with_warnings'].includes(passed.s01Result.status));

const noChangeInput = {
  ...validInput,
  current_snapshot: {
    ...snapshot('A2-SNAP-3', '2026-09-03T02:05:00.000Z', 'active'),
    previous_snapshot_id: 'A2-SNAP-1',
  },
};
const noChange = runAgent2ToA1Intake(noChangeInput);
assert.equal(noChange.status, 'no_change');
assert.equal(noChange.nextAction, 'observe');
assert.equal(noChange.s01Result, null);

const staleInput = {
  ...validInput,
  current_snapshot: {
    ...validInput.current_snapshot,
    freshness: { status: 'stale' },
  },
};
const stale = runAgent2ToA1Intake(staleInput);
assert.equal(stale.status, 'blocked');
assert.equal(stale.nextAction, 'hold_for_review');
assert.ok(stale.reasons.includes('current_snapshot_not_fresh_enough'));

const forgedPrivilege = runAgent2ToA1Intake({ ...validInput, executionAuthorized: true });
assert.equal(forgedPrivilege.status, 'blocked');
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_executionAuthorized'));

const unknownProduct = runAgent2ToA1Intake(validInput, {
  currentTime: '2026-09-03T02:05:12.000Z',
  knownProductIds: ['PROD-OTHER'],
});
assert.equal(unknownProduct.status, 'blocked');
assert.equal(unknownProduct.nextAction, 'request_information');
assert.ok(unknownProduct.reasons.some((reason) => reason.startsWith('missing:known_product_ids')));

const duplicate = runAgent2ToA1Intake(validInput, {
  currentTime: '2026-09-03T02:05:12.000Z',
  existingEvents: [passed.canonicalEvent],
});
assert.equal(duplicate.status, 'ready_for_S02');
assert.equal(duplicate.s01Result.duplicate_signal.is_possible_duplicate, true);
assert.ok(duplicate.s01Result.warnings.some((warning) => warning.code === 'POSSIBLE_DUPLICATE'));

console.log('Agent-2 to A1 intake runtime contract: PASS');
