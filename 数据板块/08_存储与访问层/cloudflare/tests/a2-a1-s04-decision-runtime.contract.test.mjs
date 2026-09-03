import assert from 'node:assert/strict';
import { runAgent2ToS03 } from '../a2-a1-s03-runtime.js';
import { runAgent2ToS04DecisionFormation } from '../a2-a1-s04-decision-runtime.js';

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
  previous_snapshot: snapshot('A2-SNAP-1', '2026-09-03T07:00:00.000Z', 'active'),
  current_snapshot: {
    ...snapshot('A2-SNAP-2', '2026-09-03T07:05:00.000Z', 'suppressed'),
    previous_snapshot_id: 'A2-SNAP-1',
  },
};

function loaded(domain, event = null) {
  let data;
  if (domain === 'C01') {
    data = { product_id: 'PROD-1', asin: 'B0TEST001', title: 'Test Product' };
  } else if (domain === 'C02') {
    data = { current_state: { availability_state: 'suppressed', observed_at: '2026-09-03T07:05:00.000Z' } };
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
    as_of: '2026-09-03T07:05:00.000Z',
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
  receivedAt: '2026-09-03T07:05:10.000Z',
  mappedAt: '2026-09-03T07:05:11.000Z',
  currentTime: '2026-09-03T07:05:12.000Z',
};

const probe = runAgent2ToS03(validInput, { ...baseOptions, availableContext: context() });
assert.equal(probe.canonicalEvent.source_agent, 'Agent-2');
const event = probe.canonicalEvent;
const sourceEvent = {
  event_id: event.event_id,
  event_type: event.event_type,
  severity: event.severity,
  summary: event.summary,
  metrics: event.metrics,
  occurred_at: event.occurred_at,
  requires_decision_by: event.requires_decision_by ?? null,
};

const ready = await runAgent2ToS04DecisionFormation(validInput, {
  ...baseOptions,
  availableContext: context(sourceEvent),
});
assert.equal(ready.status, 'decision_candidate_ready');
assert.equal(ready.nextAction, 'continue_to_task_draft_generation');
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.taskAuthorized, false);
assert.equal(ready.canonicalEvent.source_agent, 'Agent-2');
assert.equal(ready.priorityCandidate.status, 'candidate_ready');
assert.equal(ready.priorityResult.status, 'ranking_ready');
assert.equal(ready.priorityResult.rankedDecisionItems.length, 1);
assert.equal(ready.priorityResult.rankedDecisionItems[0].rank, 1);
assert.equal(ready.formationResult.status, 'formation_ready');
assert.equal(ready.decisionCandidate.decisionState, 'candidate');
assert.equal(ready.decisionCandidate.readOnly, true);
assert.equal(ready.decisionCandidate.executionAuthorized, false);
assert.equal(ready.decisionCandidate.taskGenerationMode, 'draft_only');
assert.equal(ready.decisionCandidate.decisionItemId, ready.decisionItem.decision_item_id);
assert.equal(ready.decisionCandidate.eventId, ready.canonicalEvent.event_id);

const missingSourceEvent = await runAgent2ToS04DecisionFormation(validInput, {
  ...baseOptions,
  availableContext: context(),
});
assert.equal(missingSourceEvent.status, 'needs_information');
assert.equal(missingSourceEvent.nextAction, 'request_more_context');
assert.equal(missingSourceEvent.decisionCandidate, null);
assert.equal(missingSourceEvent.executionAuthorized, false);

const staleInput = {
  ...validInput,
  current_snapshot: { ...validInput.current_snapshot, freshness: { status: 'stale' } },
};
const stale = await runAgent2ToS04DecisionFormation(staleInput, {
  ...baseOptions,
  availableContext: context(sourceEvent),
});
assert.equal(stale.status, 'blocked');
assert.equal(stale.nextAction, 'hold_for_review');
assert.equal(stale.decisionCandidate, null);
assert.equal(stale.executionAuthorized, false);

const forgedPrivilege = await runAgent2ToS04DecisionFormation(
  { ...validInput, taskAuthorized: true },
  { ...baseOptions, availableContext: context(sourceEvent) },
);
assert.equal(forgedPrivilege.status, 'blocked');
assert.equal(forgedPrivilege.nextAction, 'hold_for_review');
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_taskAuthorized'));
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);
assert.equal(forgedPrivilege.taskAuthorized, false);

console.log('Agent-2 S04 read-only decision formation contract: PASS');
