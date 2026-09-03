import assert from 'node:assert/strict';
import {
  runAgent2ProductStatus,
  A2_PRODUCT_STATUS_RUNTIME_VERSION,
} from '../a2-product-status-runtime.js';

const previous = {
  snapshot_id: 'A2-SNAP-001',
  scope_type: 'sku',
  scope_id: 'SKU-001',
  observed_at: '2026-09-03T01:00:00.000Z',
  source_refs: ['backend:sku:001'],
  domains: { availability_state: 'active' },
  raw_facts: ['Backend status active.'],
  evidence_refs: ['EVIDENCE-OLD'],
  freshness: { status: 'fresh', valid_until: null },
  confidence: 0.99,
  metadata: { product_id: 'PROD-001', asin: 'B0TEST001' },
};

const current = {
  snapshot_id: 'A2-SNAP-002',
  scope_type: 'sku',
  scope_id: 'SKU-001',
  observed_at: '2026-09-03T01:05:00.000Z',
  source_refs: ['backend:sku:001'],
  domains: { availability_state: 'suppressed' },
  raw_facts: ['Backend status suppressed.'],
  evidence_refs: ['EVIDENCE-NEW'],
  freshness: { status: 'fresh', valid_until: null },
  confidence: 0.97,
  previous_snapshot_id: 'A2-SNAP-001',
  metadata: { product_id: 'PROD-001', asin: 'B0TEST001' },
};

const result = runAgent2ProductStatus({
  input_mode: 'simulated',
  previous_snapshot: previous,
  current_snapshot: current,
});
assert.equal(result.status, 'event_ready');
assert.equal(result.nextAction, 'continue_to_A1_event_intake');
assert.equal(result.runtimeVersion, A2_PRODUCT_STATUS_RUNTIME_VERSION);
assert.equal(result.readOnly, true);
assert.equal(result.executionAuthorized, false);
assert.equal(result.dispatchAuthorized, false);
assert.equal(result.domainEvent.event_type, 'availability_suppressed');
assert.equal(result.normalizedEvent.status, 'normalized');
assert.equal(result.normalizedEvent.canonicalEvent.source_agent, 'Agent-2');
assert.equal(result.normalizedEvent.canonicalEvent.source_type, 'professional_agent');
assert.equal(result.normalizedEvent.canonicalEvent.severity, 'P1');
assert.equal(result.normalizedEvent.canonicalEvent.product_id, 'PROD-001');
assert.equal(result.normalizedEvent.canonicalEvent.asin, 'B0TEST001');

const noChange = runAgent2ProductStatus({
  input_mode: 'simulated',
  previous_snapshot: previous,
  current_snapshot: { ...current, domains: { availability_state: 'active' } },
});
assert.equal(noChange.status, 'no_change');
assert.equal(noChange.normalizedEvent, null);

const needsRecheck = runAgent2ProductStatus({
  input_mode: 'simulated',
  previous_snapshot: previous,
  current_snapshot: { ...current, domains: { availability_state: 'under_review' } },
});
assert.equal(needsRecheck.status, 'needs_recheck');
assert.equal(needsRecheck.normalizedEvent, null);

const stale = runAgent2ProductStatus({
  input_mode: 'simulated',
  previous_snapshot: previous,
  current_snapshot: { ...current, freshness: { status: 'stale', valid_until: null } },
});
assert.equal(stale.status, 'blocked');
assert.ok(stale.reasons.includes('current_snapshot_not_fresh_enough'));

const mismatchedScope = runAgent2ProductStatus({
  input_mode: 'simulated',
  previous_snapshot: previous,
  current_snapshot: { ...current, scope_id: 'SKU-OTHER' },
});
assert.equal(mismatchedScope.status, 'blocked');
assert.ok(mismatchedScope.reasons.includes('snapshot_scope_mismatch'));

const brokenLineage = runAgent2ProductStatus({
  input_mode: 'simulated',
  previous_snapshot: previous,
  current_snapshot: { ...current, previous_snapshot_id: 'WRONG' },
});
assert.equal(brokenLineage.status, 'blocked');
assert.ok(brokenLineage.reasons.includes('snapshot_lineage_mismatch'));

const sourceConflict = runAgent2ProductStatus({
  input_mode: 'simulated',
  previous_snapshot: previous,
  current_snapshot: {
    ...current,
    source_conflicts: [{ field: 'availability_state', source_refs: ['A', 'B'] }],
  },
});
assert.equal(sourceConflict.status, 'blocked');
assert.ok(sourceConflict.reasons.includes('current_snapshot_source_conflict'));

const privilegeInjection = runAgent2ProductStatus({
  input_mode: 'simulated',
  previous_snapshot: previous,
  current_snapshot: current,
  executionAuthorized: true,
});
assert.equal(privilegeInjection.status, 'blocked');
assert.ok(privilegeInjection.reasons.includes('privilege_injection_executionAuthorized'));
assert.equal(privilegeInjection.executionAuthorized, false);

const unsupportedMode = runAgent2ProductStatus({
  input_mode: 'production_write',
  previous_snapshot: previous,
  current_snapshot: current,
});
assert.equal(unsupportedMode.status, 'blocked');
assert.ok(unsupportedMode.reasons.includes('invalid_input_mode'));

console.log('Agent-2 product status runtime contract: PASS');
