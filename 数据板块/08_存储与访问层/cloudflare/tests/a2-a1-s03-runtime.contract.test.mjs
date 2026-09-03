import assert from 'node:assert/strict';
import { runAgent2ToS03 } from '../a2-a1-s03-runtime.js';

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
  previous_snapshot: snapshot('A2-SNAP-1', '2026-09-03T03:00:00.000Z', 'active'),
  current_snapshot: {
    ...snapshot('A2-SNAP-2', '2026-09-03T03:05:00.000Z', 'suppressed'),
    previous_snapshot_id: 'A2-SNAP-1',
  },
};

function loaded(domain) {
  const data = domain === 'C02'
    ? { current_state: { availability_state: 'suppressed', observed_at: '2026-09-03T03:05:00.000Z' } }
    : domain === 'C05'
      ? { recent_events: [{ event_type: 'LISTING_SUPPRESSED', event_status: 'active', occurred_at: '2026-09-03T03:05:00.000Z' }] }
      : { domain, product_id: 'PROD-1' };
  return {
    status: 'loaded',
    freshness: 'fresh',
    as_of: '2026-09-03T03:05:00.000Z',
    source: 'simulated-contract-context',
    item_count: 1,
    refs: [`test:${domain}:PROD-1`],
    data,
  };
}

const availableContext = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => `C${String(index + 1).padStart(2, '0')}`)
    .map((domain) => [domain, loaded(domain)]),
);

const ready = runAgent2ToS03(validInput, {
  receivedAt: '2026-09-03T03:05:10.000Z',
  mappedAt: '2026-09-03T03:05:11.000Z',
  currentTime: '2026-09-03T03:05:12.000Z',
  availableContext,
});
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.canonicalEvent.source_agent, 'Agent-2');
assert.equal(ready.s03Result.event_id, ready.canonicalEvent.event_id);
assert.equal(ready.s03Result.scope.product_id, 'PROD-1');
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

const missingContext = runAgent2ToS03(validInput, {
  currentTime: '2026-09-03T03:05:12.000Z',
});
assert.equal(missingContext.status, 'blocked');
assert.equal(missingContext.nextAction, 'hold_for_review');
assert.deepEqual(missingContext.reasons, ['missing_available_context']);
assert.equal(missingContext.s03Result, null);

const missingIdentityContext = {
  ...availableContext,
  C01: { status: 'missing', reason: 'Product identity is unavailable.' },
};
const blockedUpstream = runAgent2ToS03(validInput, {
  currentTime: '2026-09-03T03:05:12.000Z',
  availableContext: missingIdentityContext,
});
assert.equal(blockedUpstream.status, 'blocked');
assert.equal(blockedUpstream.nextAction, 'hold_for_review');
assert.equal(blockedUpstream.s03Result, null);
assert.ok(blockedUpstream.reasons.includes('s02_blocked'));

const staleInput = {
  ...validInput,
  current_snapshot: {
    ...validInput.current_snapshot,
    freshness: { status: 'stale' },
  },
};
const staleBlocked = runAgent2ToS03(staleInput, {
  currentTime: '2026-09-03T03:05:12.000Z',
  availableContext,
});
assert.equal(staleBlocked.status, 'blocked');
assert.equal(staleBlocked.nextAction, 'hold_for_review');
assert.equal(staleBlocked.s03Result, null);
assert.ok(staleBlocked.reasons.includes('current_snapshot_not_fresh_enough'));

const forgedPrivilege = runAgent2ToS03(
  { ...validInput, executionAuthorized: true },
  { currentTime: '2026-09-03T03:05:12.000Z', availableContext },
);
assert.equal(forgedPrivilege.status, 'blocked');
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_executionAuthorized'));

const factConflict = runAgent2ToS03(validInput, {
  receivedAt: '2026-09-03T03:05:10.000Z',
  mappedAt: '2026-09-03T03:05:11.000Z',
  currentTime: '2026-09-03T03:05:12.000Z',
  availableContext,
  normalizedElements: [
    { element_type: 'fact', source: 'Agent-2', source_agent: 'Agent-2', subject: 'price', topic_or_metric: 'price', value: 49.99, unit: 'USD', as_of: '2026-09-03T03:05:00.000Z' },
    { element_type: 'fact', source: 'Agent-6', source_agent: 'Agent-6', subject: 'price', topic_or_metric: 'price', value: 59.99, unit: 'USD', as_of: '2026-09-03T03:05:00.000Z' },
  ],
});
assert.notEqual(factConflict.nextAction, undefined);
assert.equal(factConflict.readOnly, true);
assert.equal(factConflict.executionAuthorized, false);

console.log('Agent-2 to A1 S03 runtime contract: PASS');
