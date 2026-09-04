import assert from 'node:assert/strict';
import { runAgent7LowCoverage } from '../a7-inventory-supply-runtime.js';

const baseInput = {
  input_mode: 'simulated',
  scope: { scope_type: 'product', scope_id: 'US:B0A7TEST001', product_id: 'B0A7TEST001', marketplace: 'US' },
  inventory_snapshot: { snapshot_id: 'INV-2026-09-04', observed_at: '2026-09-04T22:00:00Z', available_units: 120, freshness: 'fresh' },
  demand_baseline: { baseline_id: 'DEMAND-28D-2026-09-04', daily_units: 20, freshness: 'fresh' },
  lead_time_days: 8,
  safety_stock_days: 4,
  evidence_refs: ['sim://inventory/B0A7TEST001/2026-09-04', 'sim://demand/B0A7TEST001/28d'],
};

const result = runAgent7LowCoverage(baseInput);
assert.equal(result.status, 'event_and_response_ready');
assert.equal(result.nextAction, 'stop_before_A1_intake');
assert.equal(result.readOnly, true);
assert.equal(result.approvalGranted, false);
assert.equal(result.permissionGranted, false);
assert.equal(result.taskAuthorized, false);
assert.equal(result.executionAuthorized, false);
assert.equal(result.dispatchAuthorized, false);
assert.equal(result.productionWriteAuthorized, false);
assert.equal(result.inventorySupplyEvent.agent_id, 'Agent-7');
assert.equal(result.inventorySupplyEvent.event_type, 'LOW_COVERAGE');
assert.equal(result.inventorySupplyEvent.inventory_state.coverage_days, 6);
assert.equal(result.normalizedEvent.status, 'normalized');
assert.equal(result.normalizedResponse.status, 'normalized');
assert.equal(result.domainResponse.recommendation_candidates[0].action_authorized, false);

const safeCoverage = runAgent7LowCoverage({
  ...baseInput,
  inventory_snapshot: { ...baseInput.inventory_snapshot, available_units: 300 },
});
assert.equal(safeCoverage.status, 'no_confirmed_low_coverage');
assert.equal(safeCoverage.readOnly, true);
assert.equal(safeCoverage.productionWriteAuthorized, false);

for (const [key, value] of [
  ['approvalGranted', true], ['permissionGranted', true], ['taskAuthorized', true],
  ['executionAuthorized', true], ['dispatchAuthorized', true], ['productionWriteAuthorized', true],
  ['purchaseOrder', { units: 10 }], ['transferOrder', { units: 10 }], ['removalOrder', { units: 10 }],
]) {
  const blocked = runAgent7LowCoverage({ ...baseInput, [key]: value });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.productionWriteAuthorized, false);
  assert.ok(blocked.reasons.some((reason) => reason === `privilege_injection_${key}`));
}

const stale = runAgent7LowCoverage({
  ...baseInput,
  inventory_snapshot: { ...baseInput.inventory_snapshot, freshness: 'stale' },
});
assert.equal(stale.status, 'blocked');
assert.ok(stale.reasons.includes('inventory_snapshot_not_fresh'));

console.log('Agent-7 inventory supply runtime contract tests passed.');
