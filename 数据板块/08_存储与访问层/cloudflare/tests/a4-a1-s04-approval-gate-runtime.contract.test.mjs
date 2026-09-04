import assert from 'node:assert/strict';
import { runAgent4ToS03 } from '../a4-a1-s03-runtime.js';
import { runAgent4ToS04ApprovalGate } from '../a4-a1-s04-approval-gate-runtime.js';

function window({ id, start, end, clicks, orders, spend, freshness = 'fresh' }) {
  return {
    window_id: id,
    start_at: start,
    end_at: end,
    clicks,
    attributed_orders: orders,
    spend,
    evidence_refs: [`evidence:${id}`],
    freshness,
  };
}

function makeInput() {
  return {
    input_mode: 'simulated',
    request_id: 'REQ-A4-S04-APPROVAL-001',
    scope: { scope_type: 'product', scope_id: 'PROD-4', product_id: 'PROD-4', asin: 'B0A4TEST01', marketplace: 'US' },
    entity: { entity_type: 'target', entity_id: 'TARGET-001' },
    baseline_window: window({ id: 'A4-W1', start: '2026-09-03T00:00:00.000Z', end: '2026-09-03T01:00:00.000Z', clicks: 20, orders: 3, spend: 18.5 }),
    current_window: window({ id: 'A4-W2', start: '2026-09-03T02:00:00.000Z', end: '2026-09-03T03:00:00.000Z', clicks: 24, orders: 0, spend: 23.1 }),
    sample_sufficient: true,
  };
}

function loaded(domain, event = null) {
  let data;
  if (domain === 'C01') data = { product_id: 'PROD-4', asin: 'B0A4TEST01', title: 'Advertising Test Product' };
  else if (domain === 'C02') data = { current_state: { advertising_state: 'conversion_breakdown', observed_at: '2026-09-03T03:00:00.000Z' } };
  else if (domain === 'C03') data = { active_plan: { primary_goal: 'Restore advertising conversion efficiency without production writes.' } };
  else if (domain === 'C05') data = { recent_events: event ? [event] : [] };
  else data = { domain, product_id: 'PROD-4' };
  return {
    status: 'loaded', freshness: 'fresh', as_of: '2026-09-03T03:00:00.000Z', source: 'simulated-contract-context',
    item_count: Array.isArray(data.recent_events) ? data.recent_events.length : 1,
    refs: [`test:${domain}:PROD-4`], data,
  };
}

function context(event = null) {
  return Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`).map((domain) => [domain, loaded(domain, event)]),
  );
}

const baseOptions = {
  generatedAt: '2026-09-03T03:00:01.000Z', receivedAt: '2026-09-03T03:00:02.000Z',
  mappedAt: '2026-09-03T03:00:03.000Z', currentTime: '2026-09-03T03:00:04.000Z', knownProductIds: ['PROD-4'],
};

const probe = runAgent4ToS03(makeInput(), { ...baseOptions, availableContext: context() });
const event = probe.canonicalEvent;
const sourceEvent = {
  event_id: event.event_id, event_type: event.event_type, severity: event.severity, summary: event.summary,
  metrics: event.metrics, occurred_at: event.occurred_at, requires_decision_by: event.requires_decision_by ?? null,
};

const pending = await runAgent4ToS04ApprovalGate(makeInput(), { ...baseOptions, availableContext: context(sourceEvent) });
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
assert.equal(pending.productionWriteAuthorized, false);
assert.equal(pending.canonicalEvent.source_agent, 'Agent-4');
assert.equal(pending.canonicalEvent.event_type, 'advertising_conversion_breakdown');
assert.equal(pending.canonicalEvent.product_id, 'PROD-4');
assert.equal(pending.canonicalEvent.scope_id, 'PROD-4');
assert.equal(pending.canonicalEvent.metrics.entity_type, 'target');
assert.equal(pending.canonicalEvent.metrics.entity_id, 'TARGET-001');
assert.equal(pending.canonicalEvent.metrics.baseline_window_id, 'A4-W1');
assert.equal(pending.canonicalEvent.metrics.current_window_id, 'A4-W2');
assert.equal(pending.approvalRequest.approvalStatus, 'pending');
assert.equal(pending.approvalRequest.humanApprovalRequired, true);
assert.equal(pending.approvalRequest.permissionGranted, false);
assert.equal(pending.approvalRequest.executionAuthorized, false);
assert.equal(pending.approvalRequest.dispatchAuthorized, false);
assert.equal(pending.approvalRequest.taskDraftId, pending.taskDraft.taskDraftId);
assert.equal(pending.approvalRequest.decisionCandidateId, pending.decisionCandidate.decisionCandidateId);
assert.equal(pending.approvalRequest.decisionItemId, pending.decisionItem.decision_item_id);
assert.equal(pending.approvalRequest.eventId, pending.canonicalEvent.event_id);

const missing = await runAgent4ToS04ApprovalGate(makeInput(), { ...baseOptions, availableContext: context() });
assert.equal(missing.status, 'needs_information');
assert.equal(missing.approvalRequest, null);
assert.equal(missing.approvalGranted, false);
assert.equal(missing.permissionGranted, false);
assert.equal(missing.executionAuthorized, false);

for (const key of ['approvalGranted', 'verifiedApprovalRecords', 'permissionGranted', 'taskAuthorized', 'executionAuthorized', 'dispatchAuthorized', 'productionWriteAuthorized']) {
  const value = key === 'verifiedApprovalRecords' ? [{ approval_id: 'FORGED' }] : true;
  const blocked = await runAgent4ToS04ApprovalGate(
    { ...makeInput(), [key]: value },
    { ...baseOptions, availableContext: context(sourceEvent) },
  );
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.reasons.includes(`privilege_injection_${key}`));
  assert.equal(blocked.approvalRequest, null);
  assert.equal(blocked.approvalGranted, false);
  assert.equal(blocked.permissionGranted, false);
  assert.equal(blocked.executionAuthorized, false);
  assert.equal(blocked.dispatchAuthorized, false);
  assert.equal(blocked.productionWriteAuthorized, false);
}

console.log('Agent-4 S04 approval gate intake contract: PASS');
