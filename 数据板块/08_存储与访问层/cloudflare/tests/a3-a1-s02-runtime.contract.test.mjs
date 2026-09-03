import assert from 'node:assert/strict';
import { runAgent3ToS02 } from '../a3-a1-s02-runtime.js';

function snapshot({
  id,
  observedAt,
  price,
  confidence = 0.92,
  competitorEntityId = 'CMP-001',
  ourScopeRefs = ['OUR-PROD-001'],
}) {
  return {
    snapshot_id: id,
    competitor_entity_id: competitorEntityId,
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

const commonOptions = {
  receivedAt: '2026-09-03T08:20:05.000Z',
  mappedAt: '2026-09-03T08:20:06.000Z',
  currentTime: '2026-09-03T08:20:07.000Z',
  knownProductIds: ['OUR-PROD-001'],
  availableContext,
};

const ready = runAgent3ToS02(makeInput(), commonOptions);
assert.equal(ready.status, 'ready_for_S03');
assert.equal(ready.nextAction, 'continue_to_S03');
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.canonicalEvent.source_type, 'professional_agent');
assert.equal(ready.canonicalEvent.source_agent, 'Agent-3');
assert.equal(ready.canonicalEvent.event_type, 'competitor_price_shift');
assert.equal(ready.canonicalEvent.product_id, 'OUR-PROD-001');
assert.equal(ready.canonicalEvent.metrics.competitor_entity_id, 'CMP-001');
assert.equal(ready.canonicalEvent.metrics.relationship_type, 'direct_competitor');
assert.equal(ready.canonicalEvent.metrics.baseline_snapshot_id, 'CS-100');
assert.equal(ready.canonicalEvent.metrics.current_snapshot_id, 'CS-102');
assert.ok(['ready', 'ready_with_gaps'].includes(ready.s02Result.status));
assert.equal(ready.s02Result.next_action, 'continue_analysis');
assert.ok(Object.keys(ready.contextPackage).length > 0);
assert.equal(ready.s02Result.scope.product_id, 'OUR-PROD-001');

const wrongSource = runAgent3ToS02(
  { ...makeInput(), source_agent: 'Agent-2' },
  commonOptions,
);
assert.equal(wrongSource.status, 'blocked');
assert.equal(wrongSource.nextAction, 'hold_for_review');
assert.ok(wrongSource.reasons.includes('input_source_agent_mismatch'));
assert.equal(wrongSource.contextPackage, null);
assert.equal(wrongSource.executionAuthorized, false);
assert.equal(wrongSource.dispatchAuthorized, false);

const productScopeMismatchInput = makeInput();
productScopeMismatchInput.current_snapshot = snapshot({
  id: 'CS-102-SCOPE',
  observedAt: '2026-09-03T08:20:00.000Z',
  price: 34.99,
  ourScopeRefs: ['OTHER-PROD'],
});
const productScopeMismatch = runAgent3ToS02(productScopeMismatchInput, commonOptions);
assert.equal(productScopeMismatch.status, 'blocked');
assert.notEqual(productScopeMismatch.nextAction, 'continue_to_S03');
assert.equal(productScopeMismatch.contextPackage, null);
assert.equal(productScopeMismatch.executionAuthorized, false);
assert.equal(productScopeMismatch.dispatchAuthorized, false);

const competitorMismatchInput = makeInput();
competitorMismatchInput.current_snapshot = snapshot({
  id: 'CS-102-CMP',
  observedAt: '2026-09-03T08:20:00.000Z',
  price: 34.99,
  competitorEntityId: 'CMP-FORGED',
});
const competitorMismatch = runAgent3ToS02(competitorMismatchInput, commonOptions);
assert.equal(competitorMismatch.status, 'blocked');
assert.notEqual(competitorMismatch.nextAction, 'continue_to_S03');
assert.ok(competitorMismatch.reasons.includes('competitor_snapshot_identity_mismatch'));
assert.equal(competitorMismatch.contextPackage, null);
assert.equal(competitorMismatch.executionAuthorized, false);
assert.equal(competitorMismatch.dispatchAuthorized, false);

const forgedPrivilege = runAgent3ToS02(
  { ...makeInput(), dispatchAuthorized: true },
  commonOptions,
);
assert.equal(forgedPrivilege.status, 'blocked');
assert.equal(forgedPrivilege.nextAction, 'hold_for_review');
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_dispatchAuthorized'));
assert.equal(forgedPrivilege.contextPackage, null);
assert.equal(forgedPrivilege.readOnly, true);
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);

const s01Blocked = runAgent3ToS02(makeInput(), {
  ...commonOptions,
  knownProductIds: ['OTHER-PROD'],
});
assert.equal(s01Blocked.status, 'blocked');
assert.notEqual(s01Blocked.nextAction, 'continue_to_S03');
assert.equal(s01Blocked.s02Result, null);
assert.equal(s01Blocked.contextPackage, null);
assert.equal(s01Blocked.executionAuthorized, false);
assert.equal(s01Blocked.dispatchAuthorized, false);

const r16UpstreamNotReadyInput = makeInput();
r16UpstreamNotReadyInput.current_snapshot = snapshot({
  id: 'CS-102-UNCONFIRMED',
  observedAt: '2026-09-03T08:20:00.000Z',
  price: 35.99,
});
const r16UpstreamNotReady = runAgent3ToS02(r16UpstreamNotReadyInput, commonOptions);
assert.equal(r16UpstreamNotReady.status, 'needs_confirmation');
assert.equal(r16UpstreamNotReady.nextAction, 'observe');
assert.equal(r16UpstreamNotReady.s02Result, null);
assert.equal(r16UpstreamNotReady.contextPackage, null);
assert.equal(r16UpstreamNotReady.executionAuthorized, false);
assert.equal(r16UpstreamNotReady.dispatchAuthorized, false);

const missingContext = runAgent3ToS02(makeInput(), {
  receivedAt: commonOptions.receivedAt,
  mappedAt: commonOptions.mappedAt,
  currentTime: commonOptions.currentTime,
  knownProductIds: commonOptions.knownProductIds,
});
assert.equal(missingContext.status, 'blocked');
assert.equal(missingContext.nextAction, 'hold_for_review');
assert.deepEqual(missingContext.reasons, ['missing_available_context']);
assert.equal(missingContext.contextPackage, null);

console.log('Agent-3 to A1 S02 context runtime contract: PASS');
