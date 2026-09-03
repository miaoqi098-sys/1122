import assert from 'node:assert/strict';
import { runAgent2ToS02 } from '../a2-a1-s02-runtime.js';

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

function loaded(domain) {
  return {
    status: 'loaded',
    freshness: 'fresh',
    as_of: '2026-09-03T02:05:00.000Z',
    source: 'simulated-contract-context',
    item_count: 1,
    refs: [`test:${domain}:PROD-1`],
    data: { domain, product_id: 'PROD-1' },
  };
}

const availableContext = Object.fromEntries(
  Array.from({ length: 10 }, (_, index) => `C${String(index + 1).padStart(2, '0')}`)
    .map((domain) => [domain, loaded(domain)]),
);

const ready = runAgent2ToS02(validInput, {
  receivedAt: '2026-09-03T02:05:10.000Z',
  mappedAt: '2026-09-03T02:05:11.000Z',
  currentTime: '2026-09-03T02:05:12.000Z',
  availableContext,
});
assert.equal(ready.status, 'ready_for_S03');
assert.equal(ready.nextAction, 'continue_to_S03');
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.canonicalEvent.source_agent, 'Agent-2');
assert.equal(ready.canonicalEvent.product_id, 'PROD-1');
assert.ok(['ready', 'ready_with_gaps'].includes(ready.s02Result.status));
assert.equal(ready.s02Result.next_action, 'continue_analysis');
assert.ok(Object.keys(ready.contextPackage).length > 0);
assert.equal(ready.s02Result.scope.product_id, 'PROD-1');

const missingContext = runAgent2ToS02(validInput, {
  currentTime: '2026-09-03T02:05:12.000Z',
});
assert.equal(missingContext.status, 'blocked');
assert.equal(missingContext.nextAction, 'hold_for_review');
assert.deepEqual(missingContext.reasons, ['missing_available_context']);

const missingIdentityContext = {
  ...availableContext,
  C01: { status: 'missing', reason: 'Product identity is unavailable.' },
};
const blockedByS02 = runAgent2ToS02(validInput, {
  currentTime: '2026-09-03T02:05:12.000Z',
  availableContext: missingIdentityContext,
});
assert.equal(blockedByS02.status, 'blocked');
assert.equal(blockedByS02.nextAction, 'hold_for_review');
assert.ok(blockedByS02.reasons.includes('s02_blocked'));
assert.equal(blockedByS02.contextPackage, null);

const staleInput = {
  ...validInput,
  current_snapshot: {
    ...validInput.current_snapshot,
    freshness: { status: 'stale' },
  },
};
const upstreamBlocked = runAgent2ToS02(staleInput, {
  currentTime: '2026-09-03T02:05:12.000Z',
  availableContext,
});
assert.equal(upstreamBlocked.status, 'blocked');
assert.equal(upstreamBlocked.nextAction, 'hold_for_review');
assert.ok(upstreamBlocked.reasons.includes('current_snapshot_not_fresh_enough'));
assert.equal(upstreamBlocked.s02Result, null);

const forgedPrivilege = runAgent2ToS02(
  { ...validInput, executionAuthorized: true },
  { currentTime: '2026-09-03T02:05:12.000Z', availableContext },
);
assert.equal(forgedPrivilege.status, 'blocked');
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_executionAuthorized'));

console.log('Agent-2 to A1 S02 runtime contract: PASS');
