import assert from 'node:assert/strict';
import { runAgent2ToS03 } from '../a2-a1-s03-runtime.js';
import { runAgent2ToS04ApprovalGate } from '../a2-a1-s04-approval-gate-runtime.js';

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
  previous_snapshot: snapshot('A2-SNAP-1', '2026-09-03T08:00:00.000Z', 'active'),
  current_snapshot: {
    ...snapshot('A2-SNAP-2', '2026-09-03T08:05:00.000Z', 'suppressed'),
    previous_snapshot_id: 'A2-SNAP-1',
  },
};

function loaded(domain, event = null) {
  let data;
  if (domain === 'C01') data = { product_id: 'PROD-1', asin: 'B0TEST001', title: 'Test Product' };
  else if (domain === 'C02') data = { current_state: { availability_state: 'suppressed', observed_at: '2026-09-03T08:05:00.000Z' } };
  else if (domain === 'C03') data = { active_plan: { primary_goal: 'Restore sellability while preserving policy compliance.' } };
  else if (domain === 'C05') data = { recent_events: event ? [event] : [] };
  else data = { domain, product_id: 'PROD-1' };
  return { status: 'loaded', freshness: 'fresh', as_of: '2026-09-03T08:05:00.000Z', source: 'simulated-contract-context', item_count: Array.isArray(data.recent_events) ? data.recent_events.length : 1, refs: [`test:${domain}:PROD-1`], data };
}

function context(event = null) {
  return Object.fromEntries(Array.from({ length: 10 }, (_, index) => `C${String(index + 1).padStart(2, '0')}`).map((domain) => [domain, loaded(domain, event)]));
}

const baseOptions = {
  receivedAt: '2026-09-03T08:05:10.000Z',
  mappedAt: '2026-09-03T08:05:11.000Z',
  currentTime: '2026-09-03T08:05:12.000Z',
};

const probe = runAgent2ToS03(validInput, { ...baseOptions, availableContext: context() });
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

const pending = await runAgent2ToS04ApprovalGate(validInput, { ...baseOptions, availableContext: context(sourceEvent) });
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
assert.equal(pending.approvalRequest.approvalStatus, 'pending');
assert.equal(pending.approvalRequest.humanApprovalRequired, true);
assert.equal(pending.approvalRequest.readOnly, true);
assert.equal(pending.approvalRequest.permissionGranted, false);
assert.equal(pending.approvalRequest.executionAuthorized, false);
assert.equal(pending.approvalRequest.dispatchAuthorized, false);
assert.equal(pending.approvalRequest.taskDraftId, pending.taskDraft.taskDraftId);
assert.equal(pending.approvalRequest.decisionCandidateId, pending.decisionCandidate.decisionCandidateId);
assert.equal(pending.approvalRequest.decisionItemId, pending.decisionItem.decision_item_id);
assert.equal(pending.approvalRequest.eventId, pending.canonicalEvent.event_id);
assert.equal(pending.approvalRequest.builderRunId, pending.taskDraft.builderRunId);
assert.equal(pending.approvalRequest.conflictRunId, pending.taskDraft.conflictRunId);

const missingSourceEvent = await runAgent2ToS04ApprovalGate(validInput, { ...baseOptions, availableContext: context() });
assert.equal(missingSourceEvent.status, 'needs_information');
assert.equal(missingSourceEvent.nextAction, 'request_more_context');
assert.equal(missingSourceEvent.approvalRequest, null);
assert.equal(missingSourceEvent.approvalGranted, false);
assert.equal(missingSourceEvent.permissionGranted, false);
assert.equal(missingSourceEvent.executionAuthorized, false);
assert.equal(missingSourceEvent.dispatchAuthorized, false);

const forgedApproval = await runAgent2ToS04ApprovalGate({ ...validInput, approvalGranted: true }, { ...baseOptions, availableContext: context(sourceEvent) });
assert.equal(forgedApproval.status, 'blocked');
assert.equal(forgedApproval.nextAction, 'hold_for_review');
assert.ok(forgedApproval.reasons.includes('privilege_injection_approvalGranted'));
assert.equal(forgedApproval.approvalRequest, null);
assert.equal(forgedApproval.approvalGranted, false);
assert.equal(forgedApproval.permissionGranted, false);
assert.equal(forgedApproval.executionAuthorized, false);
assert.equal(forgedApproval.dispatchAuthorized, false);

const forgedPermission = await runAgent2ToS04ApprovalGate({ ...validInput, permissionGranted: true }, { ...baseOptions, availableContext: context(sourceEvent) });
assert.equal(forgedPermission.status, 'blocked');
assert.ok(forgedPermission.reasons.includes('privilege_injection_permissionGranted'));
assert.equal(forgedPermission.permissionGranted, false);

console.log('Agent-2 S04 approval gate intake contract: PASS');
