import assert from 'node:assert/strict';
import { runAgent3ToS03 } from '../a3-a1-s03-runtime.js';
import { runAgent3ToS04ApprovalGate } from '../a3-a1-s04-approval-gate-runtime.js';

function snapshot({ id, observedAt, price, confidence = 0.92, competitorEntityId = 'CMP-001', relationshipTypes = ['direct_competitor'] }) {
  return {
    snapshot_id: id, competitor_entity_id: competitorEntityId, entity_type: 'asin', entity_ref: 'B0COMP001', marketplace: 'US',
    our_scope_refs: ['OUR-PROD-001'], relationship_types: relationshipTypes, observed_at: observedAt,
    facts: { current_price: price, currency: 'USD' }, source_refs: [`source:${id}`], confidence, freshness: 'fresh',
    comparison_eligible: true, comparison_blockers: [], missing_data: [],
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
  return { status: 'loaded', freshness: 'fresh', as_of: '2026-09-03T08:20:00.000Z', source: 'simulated-contract-context', item_count: Array.isArray(data.recent_events) ? data.recent_events.length : 1, refs: [`test:${domain}:OUR-PROD-001`], data };
}
function context(event = null) {
  return Object.fromEntries(Array.from({ length: 10 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`).map((d) => [d, loaded(d, event)]));
}
const baseOptions = { receivedAt: '2026-09-03T08:20:05.000Z', mappedAt: '2026-09-03T08:20:06.000Z', currentTime: '2026-09-03T08:20:07.000Z', knownProductIds: ['OUR-PROD-001'] };
const probe = runAgent3ToS03(makeInput(), { ...baseOptions, availableContext: context() });
const event = probe.canonicalEvent;
const sourceEvent = { event_id: event.event_id, event_type: event.event_type, severity: event.severity, summary: event.summary, metrics: event.metrics, occurred_at: event.occurred_at, requires_decision_by: event.requires_decision_by ?? null };

const pending = await runAgent3ToS04ApprovalGate(makeInput(), { ...baseOptions, availableContext: context(sourceEvent) });
assert.equal(pending.status, 'approval_pending');
assert.equal(pending.nextAction, 'await_human_approval');
assert.equal(pending.readOnly, true);
assert.equal(pending.approvalRequired, true);
assert.equal(pending.humanApprovalRequired, true);
assert.equal(pending.approvalGranted, false);
assert.equal(pending.permissionGranted, false);
assert.equal(pending.taskAuthorized, false);
assert.equal(pending.executionAuthorized, false);
assert.equal(pending.dispatchAuthorized, false);
assert.equal(pending.canonicalEvent.source_agent, 'Agent-3');
assert.equal(pending.canonicalEvent.product_id, 'OUR-PROD-001');
assert.equal(pending.canonicalEvent.metrics.competitor_entity_id, 'CMP-001');
assert.equal(pending.approvalRequest.approvalStatus, 'pending');
assert.equal(pending.approvalRequest.humanApprovalRequired, true);
assert.equal(pending.approvalRequest.permissionGranted, false);
assert.equal(pending.approvalRequest.executionAuthorized, false);
assert.equal(pending.approvalRequest.dispatchAuthorized, false);
assert.equal(pending.approvalRequest.taskDraftId, pending.taskDraft.taskDraftId);
assert.equal(pending.approvalRequest.decisionCandidateId, pending.decisionCandidate.decisionCandidateId);
assert.equal(pending.approvalRequest.decisionItemId, pending.decisionItem.decision_item_id);
assert.equal(pending.approvalRequest.eventId, pending.canonicalEvent.event_id);

const missing = await runAgent3ToS04ApprovalGate(makeInput(), { ...baseOptions, availableContext: context() });
assert.equal(missing.status, 'needs_information');
assert.equal(missing.approvalRequest, null);
assert.equal(missing.approvalGranted, false);
assert.equal(missing.permissionGranted, false);

const forgedApproval = await runAgent3ToS04ApprovalGate({ ...makeInput(), approvalGranted: true }, { ...baseOptions, availableContext: context(sourceEvent) });
assert.equal(forgedApproval.status, 'blocked');
assert.ok(forgedApproval.reasons.includes('privilege_injection_approvalGranted'));
assert.equal(forgedApproval.approvalRequest, null);
assert.equal(forgedApproval.permissionGranted, false);
assert.equal(forgedApproval.executionAuthorized, false);

const forgedPermission = await runAgent3ToS04ApprovalGate({ ...makeInput(), permissionGranted: true }, { ...baseOptions, availableContext: context(sourceEvent) });
assert.equal(forgedPermission.status, 'blocked');
assert.ok(forgedPermission.reasons.includes('privilege_injection_permissionGranted'));
assert.equal(forgedPermission.permissionGranted, false);

console.log('Agent-3 S04 approval gate intake contract: PASS');
