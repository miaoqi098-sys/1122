import assert from 'node:assert/strict';
import { runAgent3ToS03 } from '../a3-a1-s03-runtime.js';

function snapshot({
  id,
  observedAt,
  price,
  confidence = 0.92,
  competitorEntityId = 'CMP-001',
  ourScopeRefs = ['OUR-PROD-001'],
  relationshipTypes = ['direct_competitor'],
}) {
  return {
    snapshot_id: id,
    competitor_entity_id: competitorEntityId,
    entity_type: 'asin',
    entity_ref: 'B0COMP001',
    marketplace: 'US',
    our_scope_refs: ourScopeRefs,
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
    baseline_snapshot: snapshot({ id: 'CS-200', observedAt: '2026-09-03T09:00:00.000Z', price: 39.99, confidence: 0.91 }),
    first_changed_snapshot: snapshot({ id: 'CS-201', observedAt: '2026-09-03T09:10:00.000Z', price: 34.99, confidence: 0.92 }),
    current_snapshot: snapshot({ id: 'CS-202', observedAt: '2026-09-03T09:20:00.000Z', price: 34.99, confidence: 0.93 }),
  };
}

function loaded(domain) {
  const data = domain === 'C05'
    ? { recent_events: [] }
    : { domain, product_id: 'OUR-PROD-001' };
  return {
    status: 'loaded',
    freshness: 'fresh',
    as_of: '2026-09-03T09:20:00.000Z',
    source: 'simulated-contract-context',
    item_count: 1,
    refs: [`test:${domain}:OUR-PROD-001`],
    data,
  };
}

const availableContext = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => `C${String(index + 1).padStart(2, '0')}`)
    .map((domain) => [domain, loaded(domain)]),
);

const commonOptions = {
  receivedAt: '2026-09-03T09:20:05.000Z',
  mappedAt: '2026-09-03T09:20:06.000Z',
  currentTime: '2026-09-03T09:20:07.000Z',
  knownProductIds: ['OUR-PROD-001'],
  availableContext,
};

const ready = runAgent3ToS03(makeInput(), commonOptions);
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.canonicalEvent.source_agent, 'Agent-3');
assert.equal(ready.canonicalEvent.event_type, 'competitor_price_shift');
assert.equal(ready.canonicalEvent.product_id, 'OUR-PROD-001');
assert.equal(ready.canonicalEvent.metrics.competitor_entity_id, 'CMP-001');
assert.equal(ready.s03Result.event_id, ready.canonicalEvent.event_id);
assert.equal(ready.s03Result.scope.scope_type, 'product');
assert.equal(ready.s03Result.scope.scope_id, 'OUR-PROD-001');
assert.equal(ready.s03Result.scope.product_id, 'OUR-PROD-001');
assert.ok([
  'continue_to_decision_item_builder',
  'hold_for_review',
  'request_evidence',
  'send_to_S10',
  'request_agent_review',
].includes(ready.nextAction));
if (ready.nextAction === 'continue_to_decision_item_builder') {
  assert.equal(ready.status, 'ready_for_decision_item_builder');
}

const missingContext = runAgent3ToS03(makeInput(), {
  receivedAt: commonOptions.receivedAt,
  mappedAt: commonOptions.mappedAt,
  currentTime: commonOptions.currentTime,
  knownProductIds: commonOptions.knownProductIds,
});
assert.equal(missingContext.status, 'blocked');
assert.equal(missingContext.nextAction, 'hold_for_review');
assert.deepEqual(missingContext.reasons, ['missing_available_context']);
assert.equal(missingContext.s03Result, null);
assert.equal(missingContext.canonicalEvent, null);

const forgedPrivilege = runAgent3ToS03(
  { ...makeInput(), executionAuthorized: true },
  commonOptions,
);
assert.equal(forgedPrivilege.status, 'blocked');
assert.equal(forgedPrivilege.nextAction, 'hold_for_review');
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_executionAuthorized'));
assert.equal(forgedPrivilege.s03Result, null);
assert.equal(forgedPrivilege.readOnly, true);
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);

const competitorMismatchInput = makeInput();
competitorMismatchInput.current_snapshot = snapshot({
  id: 'CS-202-FORGED',
  observedAt: '2026-09-03T09:20:00.000Z',
  price: 34.99,
  competitorEntityId: 'CMP-FORGED',
});
const competitorMismatch = runAgent3ToS03(competitorMismatchInput, commonOptions);
assert.equal(competitorMismatch.status, 'blocked');
assert.notEqual(competitorMismatch.nextAction, 'continue_to_decision_item_builder');
assert.ok(competitorMismatch.reasons.includes('competitor_snapshot_identity_mismatch'));
assert.equal(competitorMismatch.s03Result, null);
assert.equal(competitorMismatch.executionAuthorized, false);

const indirectCompetitorInput = makeInput();
indirectCompetitorInput.current_snapshot = snapshot({
  id: 'CS-202-INDIRECT',
  observedAt: '2026-09-03T09:20:00.000Z',
  price: 34.99,
  relationshipTypes: ['indirect_competitor'],
});
const indirectCompetitor = runAgent3ToS03(indirectCompetitorInput, commonOptions);
assert.equal(indirectCompetitor.status, 'needs_recheck');
assert.equal(indirectCompetitor.nextAction, 'observe');
assert.equal(indirectCompetitor.s03Result, null);
assert.equal(indirectCompetitor.executionAuthorized, false);
assert.equal(indirectCompetitor.dispatchAuthorized, false);

const factConflict = runAgent3ToS03(makeInput(), {
  ...commonOptions,
  normalizedElements: [
    {
      element_type: 'fact',
      source: 'Agent-3',
      source_agent: 'Agent-3',
      subject: 'competitor_price',
      topic_or_metric: 'competitor_price',
      value: 34.99,
      unit: 'USD',
      as_of: '2026-09-03T09:20:00.000Z',
    },
    {
      element_type: 'fact',
      source: 'Agent-6',
      source_agent: 'Agent-6',
      subject: 'competitor_price',
      topic_or_metric: 'competitor_price',
      value: 36.99,
      unit: 'USD',
      as_of: '2026-09-03T09:20:00.000Z',
    },
  ],
});
assert.notEqual(factConflict.nextAction, undefined);
assert.ok([
  'continue_to_decision_item_builder',
  'hold_for_review',
  'request_evidence',
  'send_to_S10',
  'request_agent_review',
].includes(factConflict.nextAction));
assert.equal(factConflict.readOnly, true);
assert.equal(factConflict.executionAuthorized, false);
assert.equal(factConflict.dispatchAuthorized, false);

console.log('Agent-3 to A1 S03 conflict runtime contract: PASS');
