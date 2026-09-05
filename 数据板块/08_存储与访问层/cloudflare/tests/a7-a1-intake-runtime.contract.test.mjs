import assert from 'node:assert/strict';
import { runAgent7ToA1Intake } from '../a7-a1-intake-runtime.js';

function makeInput() {
  return {
    input_mode: 'simulated',
    request_id: 'REQ-A7-S01-001',
    scope: { scope_type: 'product', scope_id: 'PROD-7', product_id: 'PROD-7', asin: 'B0A7TEST01', marketplace: 'US' },
    inventory_snapshot: { snapshot_id: 'INV-A7-S01-001', observed_at: '2026-09-04T22:00:00.000Z', available_units: 120, freshness: 'fresh' },
    demand_baseline: { baseline_id: 'DEMAND-A7-S01-001', daily_units: 20, freshness: 'fresh' },
    lead_time_days: 8,
    safety_stock_days: 4,
    evidence_refs: ['sim://inventory/PROD-7/INV-A7-S01-001', 'sim://demand/PROD-7/DEMAND-A7-S01-001'],
  };
}

const options = {
  generatedAt: '2026-09-04T22:00:01.000Z',
  receivedAt: '2026-09-04T22:00:02.000Z',
  mappedAt: '2026-09-04T22:00:03.000Z',
  currentTime: '2026-09-04T22:00:04.000Z',
  knownProductIds: ['PROD-7'],
};

const ready = runAgent7ToA1Intake(makeInput(), options);
assert.equal(ready.status, 'ready_for_S02');
assert.equal(ready.nextAction, 'continue_to_S02');
assert.equal(ready.canonicalEvent.source_agent, 'Agent-7');
assert.equal(ready.canonicalEvent.event_type, 'LOW_COVERAGE');
assert.equal(ready.canonicalEvent.product_id, 'PROD-7');
assert.equal(ready.canonicalEvent.metrics.product_id, 'PROD-7');
assert.equal(ready.canonicalEvent.metrics.available_units, 120);
assert.equal(ready.canonicalEvent.metrics.daily_units, 20);
assert.equal(ready.canonicalEvent.metrics.coverage_days, 6);
assert.equal(ready.canonicalEvent.metrics.lead_time_days, 8);
assert.equal(ready.canonicalEvent.metrics.safety_stock_days, 4);
assert.equal(ready.readOnly, true);
assert.equal(ready.approvalGranted, false);
assert.equal(ready.permissionGranted, false);
assert.equal(ready.taskAuthorized, false);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.productionWriteAuthorized, false);

for (const [key, value] of [
  ['approvalGranted', true], ['permissionGranted', true], ['taskAuthorized', true],
  ['executionAuthorized', true], ['dispatchAuthorized', true], ['productionWriteAuthorized', true],
  ['purchaseOrder', { units: 10 }], ['transferOrder', { units: 10 }], ['removalOrder', { units: 10 }],
]) {
  const blocked = runAgent7ToA1Intake({ ...makeInput(), [key]: value }, options);
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.reasons.includes(`privilege_injection_${key}`));
  assert.equal(blocked.canonicalEvent, null);
  assert.equal(blocked.productionWriteAuthorized, false);
}

const unknown = runAgent7ToA1Intake(makeInput(), { ...options, knownProductIds: ['OTHER'] });
assert.equal(unknown.status, 'blocked');
assert.notEqual(unknown.nextAction, 'continue_to_S02');
assert.equal(unknown.canonicalEvent, null);

const safeCoverageInput = makeInput();
safeCoverageInput.inventory_snapshot.available_units = 300;
const notReady = runAgent7ToA1Intake(safeCoverageInput, options);
assert.equal(notReady.status, 'no_confirmed_low_coverage');
assert.equal(notReady.nextAction, 'observe');
assert.equal(notReady.canonicalEvent, null);
assert.equal(notReady.productionWriteAuthorized, false);

console.log('Agent-7 R16 to A1 S01 intake runtime contract: PASS');
