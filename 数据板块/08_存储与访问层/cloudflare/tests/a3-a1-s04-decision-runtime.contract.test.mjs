import assert from 'node:assert/strict';
import { runAgent3ToS03 } from '../a3-a1-s03-runtime.js';
import { runAgent3ToS04DecisionFormation } from '../a3-a1-s04-decision-runtime.js';

function snapshot({ id, observedAt, price, confidence = 0.92, competitorEntityId = 'CMP-001', relationshipTypes = ['direct_competitor'], freshness = 'fresh' }) {
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
    freshness,
    comparison_eligible: true,
    comparison_blockers: [],
    missing_data: [],
  };
}

function makeInput() {
  return {
    input_mode: 'simulated',
    our_scope: { scope_type: 'product', scope_id: 'OUR-PROD-001', product_id: 'OUR-PROD-001', asin: 'B0OUR001' },
    baseline_snapshot: snapshot({ id: 'CS-100', observedAt: '2026-09-03T08:00:00.000Z', price: 39.99, confidence: 0.91 }),
    first_changed_snapshot: snapshot({ id: 'CS-101', observedAt: '2026-09-03T08:10:00.000Z', price: 34.99 }),
    current_snapshot: snapshot({ id: 'CS-102', observedAt: '2026-09-03T08:20:00.000Z', price: 34.99, confidence: 0.93 }),
  };
}

function loaded(domain, event = null) {
  let data;
  if (domain === 'C01') data = { product_id: 'OUR-PROD-001', asin: 'B0OUR001', title: 'Our Test Product' };
  else if (domain === 'C03') data = { active_plan: { primary_goal: 'Protect contribution margin while monitoring verified competitor movement.' } };
  else if (domain === 'C05') data = { recent_events: event ? [event] : [] };
  else data = { domain, product_id: 'OUR-PROD-001' };
  return {
    status: 'loaded', freshness: 'fresh', as_of: '2026-09-03T08:20:00.000Z', source: 'simulated-contract-context',
    item_count: Array.isArray(data.recent_events) ? data.recent_events.length : 1,
    refs: [`test:${domain}:OUR-PROD-001`], data,
  };
}

function context(event = null) {
  return Object.fromEntries(Array.from({ length: 10 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`).map((d) => [d, loaded(d, event)]));
}

const baseOptions = {
  receivedAt: '2026-09-03T08:20:05.000Z', mappedAt: '2026-09-03T08:20:06.000Z', currentTime: '2026-09-03T08:20:07.000Z',
  knownProductIds: ['OUR-PROD-001'],
};

const probe = runAgent3ToS03(makeInput(), { ...baseOptions, availableContext: context() });
const event = probe.canonicalEvent;
const sourceEvent = {
  event_id: event.event_id, event_type: event.event_type, severity: event.severity, summary: event.summary,
  metrics: event.metrics, occurred_at: event.occurred_at, requires_decision_by: event.requires_decision_by ?? null,
};

const ready = await runAgent3ToS04DecisionFormation(makeInput(), { ...baseOptions, availableContext: context(sourceEvent) });
assert.equal(ready.status, 'decision_candidate_ready');
assert.equal(ready.nextAction, 'continue_to_task_draft_generation');
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.taskAuthorized, false);
assert.equal(ready.canonicalEvent.source_agent, 'Agent-3');
assert.equal(ready.canonicalEvent.event_type, 'competitor_price_shift');
assert.equal(ready.canonicalEvent.product_id, 'OUR-PROD-001');
assert.equal(ready.canonicalEvent.metrics.competitor_entity_id, 'CMP-001');
assert.equal(ready.priorityCandidate.status, 'candidate_ready');
assert.equal(ready.priorityResult.status, 'ranking_ready');
assert.equal(ready.priorityResult.rankedDecisionItems[0].rank, 1);
assert.equal(ready.formationResult.status, 'formation_ready');
assert.equal(ready.decisionCandidate.decisionState, 'candidate');
assert.equal(ready.decisionCandidate.readOnly, true);
assert.equal(ready.decisionCandidate.executionAuthorized, false);
assert.equal(ready.decisionCandidate.taskGenerationMode, 'draft_only');
assert.equal(ready.decisionCandidate.decisionItemId, ready.decisionItem.decision_item_id);
assert.equal(ready.decisionCandidate.eventId, ready.canonicalEvent.event_id);

const missing = await runAgent3ToS04DecisionFormation(makeInput(), { ...baseOptions, availableContext: context() });
assert.equal(missing.status, 'needs_information');
assert.equal(missing.decisionCandidate, null);
assert.equal(missing.executionAuthorized, false);

const forged = await runAgent3ToS04DecisionFormation({ ...makeInput(), taskAuthorized: true }, { ...baseOptions, availableContext: context(sourceEvent) });
assert.equal(forged.status, 'blocked');
assert.ok(forged.reasons.includes('privilege_injection_taskAuthorized'));
assert.equal(forged.decisionCandidate, null);
assert.equal(forged.executionAuthorized, false);
assert.equal(forged.dispatchAuthorized, false);
assert.equal(forged.taskAuthorized, false);

const indirectInput = makeInput();
indirectInput.current_snapshot = snapshot({ id: 'CS-102-INDIRECT', observedAt: '2026-09-03T08:20:00.000Z', price: 34.99, relationshipTypes: ['indirect_competitor'] });
const indirect = await runAgent3ToS04DecisionFormation(indirectInput, { ...baseOptions, availableContext: context(sourceEvent) });
assert.notEqual(indirect.nextAction, 'continue_to_task_draft_generation');
assert.equal(indirect.decisionCandidate, null);
assert.equal(indirect.executionAuthorized, false);

console.log('Agent-3 S04 read-only decision formation contract: PASS');
