import assert from 'node:assert/strict';
import { runAgent3ToDecisionItem } from '../a3-a1-decision-item-runtime.js';

function snapshot({ id, observedAt, price, confidence = 0.92, competitorEntityId = 'CMP-001', relationshipTypes = ['direct_competitor'] }) {
  return {
    snapshot_id: id,
    competitor_entity_id: competitorEntityId,
    entity_type: 'asin',
    entity_ref: 'B0COMP001',
    marketplace: 'US',
    our_scope_refs: ['OUR-PROD-001'],
    relationship_types: relationshipTypes,
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

function makeInput() {
  return {
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
}

function loaded(domain) {
  return {
    status: 'loaded',
    freshness: 'fresh',
    as_of: '2026-09-03T08:20:00.000Z',
    source: 'simulated-contract-context',
    item_count: 1,
    refs: [`test:${domain}:OUR-PROD-001`],
    data: { domain, product_id: 'OUR-PROD-001' },
  };
}

const availableContext = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => `C${String(index + 1).padStart(2, '0')}`)
    .map((domain) => [domain, loaded(domain)]),
);

const options = {
  receivedAt: '2026-09-03T08:20:05.000Z',
  mappedAt: '2026-09-03T08:20:06.000Z',
  currentTime: '2026-09-03T08:20:07.000Z',
  knownProductIds: ['OUR-PROD-001'],
  availableContext,
};

const ready = runAgent3ToDecisionItem(makeInput(), options);
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.canonicalEvent.source_agent, 'Agent-3');
assert.equal(ready.canonicalEvent.product_id, 'OUR-PROD-001');
assert.equal(ready.canonicalEvent.metrics.competitor_entity_id, 'CMP-001');
assert.equal(ready.s03BridgeResult.s03Result.event_id, ready.canonicalEvent.event_id);
assert.equal(ready.s03BridgeResult.s03Result.scope.product_id, 'OUR-PROD-001');
if (ready.status === 'ready_for_S04') {
  assert.equal(ready.nextAction, 'continue_to_S04');
  assert.ok(ready.decisionItems.length > 0);
  assert.ok(ready.decisionItems.every((item) => item.source_event_refs.includes(ready.canonicalEvent.event_id)));
  assert.ok(ready.decisionItems.every((item) => item.scope.product_id === 'OUR-PROD-001'));
} else {
  assert.ok(['needs_information', 'blocked'].includes(ready.status));
  assert.equal(ready.decisionItems.length, 0);
}

const missingContext = runAgent3ToDecisionItem(makeInput(), {
  receivedAt: options.receivedAt,
  mappedAt: options.mappedAt,
  currentTime: options.currentTime,
  knownProductIds: options.knownProductIds,
});
assert.equal(missingContext.status, 'blocked');
assert.equal(missingContext.nextAction, 'hold_for_review');
assert.equal(missingContext.decisionItems.length, 0);
assert.equal(missingContext.executionAuthorized, false);
assert.equal(missingContext.dispatchAuthorized, false);

const forgedPrivilege = runAgent3ToDecisionItem(
  { ...makeInput(), productionWriteAuthorized: true },
  options,
);
assert.equal(forgedPrivilege.status, 'blocked');
assert.equal(forgedPrivilege.nextAction, 'hold_for_review');
assert.equal(forgedPrivilege.decisionItems.length, 0);
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);

const competitorMismatchInput = makeInput();
competitorMismatchInput.current_snapshot = snapshot({
  id: 'CS-102-FORGED',
  observedAt: '2026-09-03T08:20:00.000Z',
  price: 34.99,
  competitorEntityId: 'CMP-FORGED',
});
const competitorMismatch = runAgent3ToDecisionItem(competitorMismatchInput, options);
assert.equal(competitorMismatch.status, 'blocked');
assert.notEqual(competitorMismatch.nextAction, 'continue_to_S04');
assert.equal(competitorMismatch.decisionItems.length, 0);
assert.equal(competitorMismatch.executionAuthorized, false);
assert.equal(competitorMismatch.dispatchAuthorized, false);

const notDirectCompetitorInput = makeInput();
notDirectCompetitorInput.current_snapshot = snapshot({
  id: 'CS-102-INDIRECT',
  observedAt: '2026-09-03T08:20:00.000Z',
  price: 34.99,
  relationshipTypes: ['indirect_competitor'],
});
const notDirectCompetitor = runAgent3ToDecisionItem(notDirectCompetitorInput, options);
assert.notEqual(notDirectCompetitor.nextAction, 'continue_to_S04');
assert.equal(notDirectCompetitor.decisionItems.length, 0);
assert.equal(notDirectCompetitor.executionAuthorized, false);
assert.equal(notDirectCompetitor.dispatchAuthorized, false);

const conflictRoute = runAgent3ToDecisionItem(makeInput(), {
  ...options,
  normalizedElements: [
    { element_type: 'fact', source: 'Agent-3', source_agent: 'Agent-3', subject: 'competitor_price', topic_or_metric: 'price', value: 34.99, unit: 'USD', as_of: '2026-09-03T08:20:00.000Z' },
    { element_type: 'fact', source: 'Agent-6', source_agent: 'Agent-6', subject: 'competitor_price', topic_or_metric: 'price', value: 38.99, unit: 'USD', as_of: '2026-09-03T08:20:00.000Z' },
  ],
});
assert.equal(conflictRoute.readOnly, true);
assert.equal(conflictRoute.executionAuthorized, false);
assert.equal(conflictRoute.dispatchAuthorized, false);
if (conflictRoute.s03BridgeResult?.nextAction !== 'continue_to_decision_item_builder') {
  assert.equal(conflictRoute.decisionItems.length, 0);
}

console.log('Agent-3 S03 to DecisionItemBuilder runtime contract: PASS');
