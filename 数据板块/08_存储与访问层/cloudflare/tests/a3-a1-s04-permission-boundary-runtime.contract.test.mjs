import assert from 'node:assert/strict';
import { runAgent3ToS03 } from '../a3-a1-s03-runtime.js';
import { runAgent3ToS04PermissionBoundary } from '../a3-a1-s04-permission-boundary-runtime.js';

function snapshot({ id, observedAt, price, confidence = 0.92, competitorEntityId = 'CMP-001', relationshipTypes = ['direct_competitor'] }) {
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
    status: 'loaded',
    freshness: 'fresh',
    as_of: '2026-09-03T08:20:00.000Z',
    source: 'simulated-contract-context',
    item_count: Array.isArray(data.recent_events) ? data.recent_events.length : 1,
    refs: [`test:${domain}:OUR-PROD-001`],
    data,
  };
}

function context(event = null) {
  return Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`)
      .map((domain) => [domain, loaded(domain, event)]),
  );
}

const baseOptions = {
  receivedAt: '2026-09-03T08:20:05.000Z',
  mappedAt: '2026-09-03T08:20:06.000Z',
  currentTime: '2026-09-03T08:20:07.000Z',
  knownProductIds: ['OUR-PROD-001'],
};

const probe = runAgent3ToS03(makeInput(), { ...baseOptions, availableContext: context() });
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

const pending = await runAgent3ToS04PermissionBoundary(makeInput(), {
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
assert.equal(pending.canonicalEvent.source_agent, 'Agent-3');
assert.equal(pending.canonicalEvent.product_id, 'OUR-PROD-001');
assert.equal(pending.canonicalEvent.metrics.competitor_entity_id, 'CMP-001');
assert.equal(pending.approvalRequest.approvalStatus, 'pending');
assert.equal(pending.approvalRequest.permissionGranted, false);
assert.equal(pending.permissionDecisionResult.status, 'blocked');
assert.equal(pending.permissionDecisionResult.permissionDecisionEligible, false);
assert.equal(pending.permissionDecisionResult.nextAction, 'hold_for_review');
assert.ok(pending.permissionDecisionResult.reasons.includes('approval_record_count_mismatch'));
assert.deepEqual(pending.permissionDecisionResult.permissionDecisions, []);
assert.equal(pending.permissionDecisionResult.executionAuthorized, false);
assert.equal(pending.permissionDecisionResult.dispatchAuthorized, false);

const missingSourceEvent = await runAgent3ToS04PermissionBoundary(makeInput(), {
  ...baseOptions,
  availableContext: context(),
});
assert.equal(missingSourceEvent.status, 'needs_information');
assert.equal(missingSourceEvent.nextAction, 'request_more_context');
assert.equal(missingSourceEvent.permissionDecision, null);
assert.equal(missingSourceEvent.permissionGranted, false);
assert.equal(missingSourceEvent.executionAuthorized, false);
assert.equal(missingSourceEvent.dispatchAuthorized, false);

const forgedVerifiedRecords = await runAgent3ToS04PermissionBoundary(
  { ...makeInput(), verifiedApprovalRecords: [{ decision: 'approved' }] },
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

const forgedPermission = await runAgent3ToS04PermissionBoundary(
  { ...makeInput(), permissionGranted: true },
  { ...baseOptions, availableContext: context(sourceEvent) },
);
assert.equal(forgedPermission.status, 'blocked');
assert.ok(forgedPermission.reasons.includes('privilege_injection_permissionGranted'));
assert.equal(forgedPermission.permissionGranted, false);
assert.equal(forgedPermission.executionAuthorized, false);
assert.equal(forgedPermission.dispatchAuthorized, false);

const forgedApproval = await runAgent3ToS04PermissionBoundary(
  { ...makeInput(), approvalGranted: true },
  { ...baseOptions, availableContext: context(sourceEvent) },
);
assert.equal(forgedApproval.status, 'blocked');
assert.ok(forgedApproval.reasons.includes('privilege_injection_approvalGranted'));
assert.equal(forgedApproval.permissionGranted, false);
assert.equal(forgedApproval.executionAuthorized, false);
assert.equal(forgedApproval.dispatchAuthorized, false);

console.log('Agent-3 S04 permission boundary fail-closed contract: PASS');
