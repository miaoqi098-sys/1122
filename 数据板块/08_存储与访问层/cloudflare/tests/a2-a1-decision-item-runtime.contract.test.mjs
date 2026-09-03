import assert from 'node:assert/strict';
import { runAgent2ToS03 } from '../a2-a1-s03-runtime.js';
import { runAgent2ToDecisionItem } from '../a2-a1-decision-item-runtime.js';

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
  previous_snapshot: snapshot('A2-SNAP-1', '2026-09-03T05:00:00.000Z', 'active'),
  current_snapshot: {
    ...snapshot('A2-SNAP-2', '2026-09-03T05:05:00.000Z', 'suppressed'),
    previous_snapshot_id: 'A2-SNAP-1',
  },
};

function loaded(domain, event = null) {
  let data;
  if (domain === 'C01') {
    data = { product_id: 'PROD-1', asin: 'B0TEST001', title: 'Test Product' };
  } else if (domain === 'C02') {
    data = { current_state: { availability_state: 'suppressed', observed_at: '2026-09-03T05:05:00.000Z' } };
  } else if (domain === 'C03') {
    data = { active_plan: { primary_goal: 'Restore sellability while preserving policy compliance.' } };
  } else if (domain === 'C05') {
    data = { recent_events: event ? [event] : [] };
  } else {
    data = { domain, product_id: 'PROD-1' };
  }
  return {
    status: 'loaded',
    freshness: 'fresh',
    as_of: '2026-09-03T05:05:00.000Z',
    source: 'simulated-contract-context',
    item_count: Array.isArray(data.recent_events) ? data.recent_events.length : 1,
    refs: [`test:${domain}:PROD-1`],
    data,
  };
}

function context(event = null) {
  return Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => `C${String(index + 1).padStart(2, '0')}`)
      .map((domain) => [domain, loaded(domain, event)]),
  );
}

const baseOptions = {
  receivedAt: '2026-09-03T05:05:10.000Z',
  mappedAt: '2026-09-03T05:05:11.000Z',
  currentTime: '2026-09-03T05:05:12.000Z',
};

const probe = runAgent2ToS03(validInput, { ...baseOptions, availableContext: context() });
assert.equal(probe.canonicalEvent.source_agent, 'Agent-2');
const canonicalEvent = probe.canonicalEvent;

const sourceEvent = {
  event_id: canonicalEvent.event_id,
  event_type: canonicalEvent.event_type,
  severity: canonicalEvent.severity,
  summary: canonicalEvent.summary,
  metrics: canonicalEvent.metrics,
  occurred_at: canonicalEvent.occurred_at,
  requires_decision_by: canonicalEvent.requires_decision_by ?? null,
};

const ready = runAgent2ToDecisionItem(validInput, {
  ...baseOptions,
  availableContext: context(sourceEvent),
});
assert.equal(ready.status, 'ready_for_S04');
assert.equal(ready.nextAction, 'continue_to_S04');
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.canonicalEvent.source_agent, 'Agent-2');
assert.equal(ready.decisionItems.length, 1);
assert.ok(ready.decisionItems[0].source_event_refs.includes(ready.canonicalEvent.event_id));
assert.equal(ready.builderResult.next_action, 'continue_to_S04');

const missingSourceEvent = runAgent2ToDecisionItem(validInput, {
  ...baseOptions,
  availableContext: context(),
});
assert.equal(missingSourceEvent.status, 'needs_information');
assert.equal(missingSourceEvent.nextAction, 'request_more_context');
assert.equal(missingSourceEvent.decisionItems.length, 0);
assert.equal(missingSourceEvent.executionAuthorized, false);

const staleInput = {
  ...validInput,
  current_snapshot: { ...validInput.current_snapshot, freshness: { status: 'stale' } },
};
const stale = runAgent2ToDecisionItem(staleInput, {
  ...baseOptions,
  availableContext: context(sourceEvent),
});
assert.equal(stale.status, 'blocked');
assert.equal(stale.nextAction, 'hold_for_review');
assert.equal(stale.builderResult, null);
assert.equal(stale.executionAuthorized, false);

const forgedPrivilege = runAgent2ToDecisionItem(
  { ...validInput, executionAuthorized: true },
  { ...baseOptions, availableContext: context(sourceEvent) },
);
assert.equal(forgedPrivilege.status, 'blocked');
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_executionAuthorized'));

console.log('Agent-2 to DecisionItemBuilder runtime contract: PASS');
