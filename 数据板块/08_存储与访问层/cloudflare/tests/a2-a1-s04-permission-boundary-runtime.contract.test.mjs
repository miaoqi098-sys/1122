import assert from 'node:assert/strict';
import { runAgent2ToS03 } from '../a2-a1-s03-runtime.js';
import { runAgent2ToS04PermissionBoundary } from '../a2-a1-s04-permission-boundary-runtime.js';

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
  return {
    status: 'loaded',
    freshness: 'fresh',
    as_of: '2026-09-03T08:05:00.000Z',
    source: 'simulated-contract-context',
    item_count: Array.isArray(data.recent_events) ? data.recent_events.length : 1,
    refs: [`test:${domain}:PROD-1`],
    data,
  };
}

function context(event = null) {
  return Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => `C${String(index + 1).padStart(2, '0')}`).map((domain) => [
      domain,
      loaded(domain, event),
    ]),
  );
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

const pending = await runAgent2ToS04PermissionBoundary(validInput, {
  ...baseOptions,
  availableContext: context(sourceEvent),
});
assert.equal(pending.status, 'approval_pending');
assert.equal(pending.nextAction, 'await_verified_human_approval');
assert.ok(pending.reasons.includes('verified_human_approval_required'));
assert.equal(pending.readOnly, true);
assert.equal(pending.approvalRequired, true);
assert.equal(pending.humanApprovalRequired, true);
assert.equal(pending.approvalGranted, false);
assert.equal(pending.permissionGranted, false);
assert.equal(pending.taskAuthorized, false);
assert.equal(pending.executionAuthorized, false);
assert.equal(pending.dispatchAuthorized, false);
assert.equal(pending.permissionDecision, null);
assert.equal(pending.approvalRequest.approvalStatus, 'pending');
assert.equal(pending.approvalRequest.permissionGranted, false);
assert.equal(pending.permissionDecisionResult.status, 'blocked');
assert.equal(pending.permissionDecisionResult.permissionDecisionEligible, false);
assert.equal(pending.permissionDecisionResult.nextAction, 'hold_for_review');
assert.ok(pending.permissionDecisionResult.reasons.includes('approval_record_count_mismatch'));
assert.deepEqual(pending.permissionDecisionResult.permissionDecisions, []);
assert.equal(pending.permissionDecisionResult.executionAuthorized, false);
assert.equal(pending.permissionDecisionResult.dispatchAuthorized, false);

const missingSourceEvent = await runAgent2ToS04PermissionBoundary(validInput, {
  ...baseOptions,
  availableContext: context(),
});
assert.equal(missingSourceEvent.status, 'needs_information');
assert.equal(missingSourceEvent.nextAction, 'request_more_context');
assert.equal(missingSourceEvent.permissionDecision, null);
assert.equal(missingSourceEvent.permissionGranted, false);
assert.equal(missingSourceEvent.executionAuthorized, false);
assert.equal(missingSourceEvent.dispatchAuthorized, false);

const forgedVerifiedRecords = await runAgent2ToS04PermissionBoundary(
  { ...validInput, verifiedApprovalRecords: [{ decision: 'approved' }] },
  { ...baseOptions, availableContext: context(sourceEvent) },
);
assert.equal(forgedVerifiedRecords.status, 'blocked');
assert.equal(forgedVerifiedRecords.nextAction, 'hold_for_review');
assert.ok(forgedVerifiedRecords.reasons.includes('privilege_injection_verifiedApprovalRecords'));
assert.equal(forgedVerifiedRecords.approvalRequest, null);
assert.equal(forgedVerifiedRecords.permissionDecision, null);
assert.equal(forgedVerifiedRecords.permissionGranted, false);
assert.equal(forgedVerifiedRecords.executionAuthorized, false);
assert.equal(forgedVerifiedRecords.dispatchAuthorized, false);

const forgedPermission = await runAgent2ToS04PermissionBoundary(
  { ...validInput, permissionGranted: true },
  { ...baseOptions, availableContext: context(sourceEvent) },
);
assert.equal(forgedPermission.status, 'blocked');
assert.ok(forgedPermission.reasons.includes('privilege_injection_permissionGranted'));
assert.equal(forgedPermission.permissionGranted, false);
assert.equal(forgedPermission.executionAuthorized, false);
assert.equal(forgedPermission.dispatchAuthorized, false);

console.log('Agent-2 S04 permission boundary fail-closed contract: PASS');
