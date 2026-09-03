import assert from 'node:assert/strict';
import { runAgent3ToA1Intake } from '../a3-a1-intake-runtime.js';

function snapshot({ id, observedAt, price, confidence = 0.92, ourScopeRefs = ['OUR-PROD-001'] }) {
  return {
    snapshot_id: id,
    competitor_entity_id: 'CMP-001',
    entity_type: 'asin',
    entity_ref: 'B0COMP001',
    marketplace: 'US',
    our_scope_refs: ourScopeRefs,
    relationship_types: ['direct_competitor'],
    observed_at: observedAt,
    facts: { current_price: price, currency: 'USD' },
    source_refs: [`source:${id}`],
    confidence,
    freshness: 'fresh',
    comparison_eligible: true,
    comparison_blockers: [],
    missing_data: [],
  };
}

const validInput = {
  input_mode: 'simulated',
  our_scope: {
    scope_type: 'product',
    scope_id: 'OUR-PROD-001',
    product_id: 'OUR-PROD-001',
    asin: 'B0OUR001',
  },
  baseline_snapshot: snapshot({ id: 'CS-100', observedAt: '2026-09-03T08:00:00.000Z', price: 39.99, confidence: 0.91 }),
  first_changed_snapshot: snapshot({ id: 'CS-101', observedAt: '2026-09-03T08:10:00.000Z', price: 34.99, confidence: 0.92 }),
  current_snapshot: snapshot({ id: 'CS-102', observedAt: '2026-09-03T08:20:00.000Z', price: 34.99, confidence: 0.93 }),
};

const ready = runAgent3ToA1Intake(validInput, {
  receivedAt: '2026-09-03T08:20:05.000Z',
  mappedAt: '2026-09-03T08:20:06.000Z',
  currentTime: '2026-09-03T08:20:07.000Z',
  knownProductIds: ['OUR-PROD-001'],
});
assert.equal(ready.status, 'ready_for_S02');
assert.equal(ready.nextAction, 'continue_to_S02');
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.agent3Result.status, 'event_ready');
assert.equal(ready.agent3Result.normalizedEvent.status, 'normalized');
assert.ok(['passed', 'passed_with_warnings'].includes(ready.s01Result.status));
assert.equal(ready.canonicalEvent.source_type, 'professional_agent');
assert.equal(ready.canonicalEvent.source_agent, 'Agent-3');
assert.equal(ready.canonicalEvent.event_type, 'competitor_price_shift');
assert.equal(ready.canonicalEvent.product_id, 'OUR-PROD-001');
assert.equal(ready.canonicalEvent.metrics.competitor_entity_id, 'CMP-001');

const unknownProduct = runAgent3ToA1Intake(validInput, {
  currentTime: '2026-09-03T08:20:07.000Z',
  knownProductIds: ['OTHER-PROD'],
});
assert.equal(unknownProduct.status, 'blocked');
assert.notEqual(unknownProduct.nextAction, 'continue_to_S02');
assert.equal(unknownProduct.canonicalEvent, null);
assert.equal(unknownProduct.executionAuthorized, false);
assert.equal(unknownProduct.dispatchAuthorized, false);

const scopeMismatch = runAgent3ToA1Intake({
  ...validInput,
  current_snapshot: snapshot({
    id: 'CS-102B',
    observedAt: '2026-09-03T08:20:00.000Z',
    price: 34.99,
    ourScopeRefs: ['OTHER-PROD'],
  }),
});
assert.equal(scopeMismatch.status, 'blocked');
assert.equal(scopeMismatch.nextAction, 'hold_for_review');
assert.equal(scopeMismatch.canonicalEvent, null);

const forgedPrivilege = runAgent3ToA1Intake({
  ...validInput,
  permissionGranted: true,
});
assert.equal(forgedPrivilege.status, 'blocked');
assert.equal(forgedPrivilege.nextAction, 'hold_for_review');
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_permissionGranted'));
assert.equal(forgedPrivilege.agent3Result, null);
assert.equal(forgedPrivilege.canonicalEvent, null);
assert.equal(forgedPrivilege.readOnly, true);
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);

const unconfirmed = runAgent3ToA1Intake({
  ...validInput,
  current_snapshot: snapshot({ id: 'CS-102C', observedAt: '2026-09-03T08:20:00.000Z', price: 35.99 }),
});
assert.equal(unconfirmed.status, 'needs_confirmation');
assert.equal(unconfirmed.nextAction, 'observe');
assert.equal(unconfirmed.s01Result, null);
assert.equal(unconfirmed.canonicalEvent, null);
assert.equal(unconfirmed.executionAuthorized, false);
assert.equal(unconfirmed.dispatchAuthorized, false);

console.log('Agent-3 to A1 S01 intake runtime contract: PASS');
