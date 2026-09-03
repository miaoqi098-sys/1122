import assert from 'node:assert/strict';
import { runAgent3CompetitorPriceSignal } from '../a3-competitor-price-runtime.js';

function snapshot({
  id,
  observedAt,
  price,
  confidence = 0.92,
  comparisonEligible = true,
  entityId = 'CMP-001',
  entityRef = 'B0COMP001',
  marketplace = 'US',
  ourScopeRefs = ['OUR-PROD-001'],
  relationshipTypes = ['direct_competitor'],
}) {
  return {
    snapshot_id: id,
    competitor_entity_id: entityId,
    entity_type: 'asin',
    entity_ref: entityRef,
    marketplace,
    our_scope_refs: ourScopeRefs,
    relationship_types: relationshipTypes,
    observed_at: observedAt,
    facts: {
      current_price: price,
      currency: 'USD',
    },
    source_refs: [`source:${id}`],
    confidence,
    freshness: 'fresh',
    comparison_eligible: comparisonEligible,
    comparison_blockers: [],
    missing_data: [],
  };
}

const ourScope = {
  scope_type: 'product',
  scope_id: 'OUR-PROD-001',
  product_id: 'OUR-PROD-001',
  asin: 'B0OUR001',
};

const baseline = snapshot({
  id: 'CS-100',
  observedAt: '2026-09-03T08:00:00.000Z',
  price: 39.99,
  confidence: 0.91,
});
const firstChanged = snapshot({
  id: 'CS-101',
  observedAt: '2026-09-03T08:10:00.000Z',
  price: 34.99,
  confidence: 0.92,
});
const current = snapshot({
  id: 'CS-102',
  observedAt: '2026-09-03T08:20:00.000Z',
  price: 34.99,
  confidence: 0.93,
});

const validInput = {
  input_mode: 'simulated',
  our_scope: ourScope,
  baseline_snapshot: baseline,
  first_changed_snapshot: firstChanged,
  current_snapshot: current,
};

const ready = runAgent3CompetitorPriceSignal(validInput, {
  receivedAt: '2026-09-03T08:20:05.000Z',
  mappedAt: '2026-09-03T08:20:06.000Z',
});
assert.equal(ready.status, 'event_ready');
assert.equal(ready.nextAction, 'continue_to_A1_event_intake');
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.domainEvent.event_type, 'competitor_price_shift');
assert.equal(ready.domainEvent.metrics.baseline_price, 39.99);
assert.equal(ready.domainEvent.metrics.current_price, 34.99);
assert.equal(ready.domainEvent.metrics.decrease_percent, 12.5);
assert.equal(ready.normalizedEvent.status, 'normalized');
assert.equal(ready.normalizedEvent.canonicalEvent.source_agent, 'Agent-3');
assert.equal(ready.normalizedEvent.canonicalEvent.event_type, 'competitor_price_shift');
assert.equal(ready.normalizedEvent.canonicalEvent.severity, 'P2');
assert.equal(ready.normalizedEvent.canonicalEvent.product_id, 'OUR-PROD-001');
assert.equal(ready.normalizedEvent.readOnly, true);
assert.equal(ready.normalizedEvent.executionAuthorized, false);
assert.equal(ready.normalizedEvent.dispatchAuthorized, false);

const unconfirmed = runAgent3CompetitorPriceSignal({
  ...validInput,
  current_snapshot: snapshot({
    id: 'CS-102B',
    observedAt: '2026-09-03T08:20:00.000Z',
    price: 35.99,
  }),
});
assert.equal(unconfirmed.status, 'needs_confirmation');
assert.equal(unconfirmed.nextAction, 'observe');
assert.ok(unconfirmed.reasons.includes('price_change_not_confirmed_by_second_observation'));
assert.equal(unconfirmed.domainEvent, null);
assert.equal(unconfirmed.normalizedEvent, null);
assert.equal(unconfirmed.executionAuthorized, false);
assert.equal(unconfirmed.dispatchAuthorized, false);

const nonComparable = runAgent3CompetitorPriceSignal({
  ...validInput,
  current_snapshot: snapshot({
    id: 'CS-102C',
    observedAt: '2026-09-03T08:20:00.000Z',
    price: 34.99,
    comparisonEligible: false,
  }),
});
assert.equal(nonComparable.status, 'blocked');
assert.equal(nonComparable.nextAction, 'hold_for_review');
assert.ok(nonComparable.reasons.includes('current_snapshot_not_comparison_eligible'));
assert.equal(nonComparable.domainEvent, null);
assert.equal(nonComparable.normalizedEvent, null);

const scopeMismatch = runAgent3CompetitorPriceSignal({
  ...validInput,
  current_snapshot: snapshot({
    id: 'CS-102D',
    observedAt: '2026-09-03T08:20:00.000Z',
    price: 34.99,
    ourScopeRefs: ['OTHER-PROD'],
  }),
});
assert.equal(scopeMismatch.status, 'blocked');
assert.ok(scopeMismatch.reasons.includes('competitor_snapshot_our_scope_mismatch'));
assert.equal(scopeMismatch.domainEvent, null);

const identityMismatch = runAgent3CompetitorPriceSignal({
  ...validInput,
  current_snapshot: snapshot({
    id: 'CS-102E',
    observedAt: '2026-09-03T08:20:00.000Z',
    price: 34.99,
    entityId: 'CMP-OTHER',
  }),
});
assert.equal(identityMismatch.status, 'blocked');
assert.ok(identityMismatch.reasons.includes('competitor_snapshot_identity_mismatch'));
assert.equal(identityMismatch.domainEvent, null);

const forgedPrivilege = runAgent3CompetitorPriceSignal({
  ...validInput,
  executionAuthorized: true,
});
assert.equal(forgedPrivilege.status, 'blocked');
assert.equal(forgedPrivilege.nextAction, 'hold_for_review');
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_executionAuthorized'));
assert.equal(forgedPrivilege.domainEvent, null);
assert.equal(forgedPrivilege.normalizedEvent, null);
assert.equal(forgedPrivilege.readOnly, true);
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);

const lowConfidence = runAgent3CompetitorPriceSignal({
  ...validInput,
  current_snapshot: snapshot({
    id: 'CS-102F',
    observedAt: '2026-09-03T08:20:00.000Z',
    price: 34.99,
    confidence: 0.7,
  }),
});
assert.equal(lowConfidence.status, 'needs_confirmation');
assert.ok(lowConfidence.reasons.includes('confirmed_price_change_confidence_below_v1_threshold'));
assert.equal(lowConfidence.domainEvent, null);

console.log('Agent-3 read-only competitor price runtime contract: PASS');
