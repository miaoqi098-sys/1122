import assert from 'node:assert/strict';
import { runAgent7ToS02 } from '../a7-a1-s02-runtime.js';

function makeInput() {
  return {
    input_mode: 'simulated',
    request_id: 'REQ-A7-S02-001',
    scope: { scope_type: 'product', scope_id: 'PROD-7', product_id: 'PROD-7', asin: 'B0A7TEST01', marketplace: 'US' },
    inventory_snapshot: { snapshot_id: 'INV-A7-S02-001', observed_at: '2026-09-04T22:00:00.000Z', available_units: 120, freshness: 'fresh' },
    demand_baseline: { baseline_id: 'DEMAND-A7-S02-001', daily_units: 20, freshness: 'fresh' },
    lead_time_days: 8,
    safety_stock_days: 4,
    evidence_refs: ['sim://inventory/PROD-7/INV-A7-S02-001', 'sim://demand/PROD-7/DEMAND-A7-S02-001'],
  };
}

function loaded(domain) {
  let data;
  if (domain === 'C01') data = { product_id: 'PROD-7', asin: 'B0A7TEST01', title: 'Inventory Test Product' };
  else if (domain === 'C02') data = { current_state: { inventory_state: 'low_coverage', observed_at: '2026-09-04T22:00:00.000Z' } };
  else if (domain === 'C03') data = { active_plan: { primary_goal: 'Assess supply risk without inventory writes.' } };
  else data = { domain, product_id: 'PROD-7' };
  return {
    status: 'loaded', freshness: 'fresh', as_of: '2026-09-04T22:00:00.000Z',
    source: 'simulated-contract-context', item_count: 1,
    refs: [`test:${domain}:PROD-7`], data,
  };
}

function context() {
  return Object.fromEntries(Array.from({ length: 10 }, (_, i) => `C${String(i + 1).padStart(2, '0')}`).map((domain) => [domain, loaded(domain)]));
}

const options = {
  generatedAt: '2026-09-04T22:00:01.000Z',
  receivedAt: '2026-09-04T22:00:02.000Z',
  mappedAt: '2026-09-04T22:00:03.000Z',
  currentTime: '2026-09-04T22:00:04.000Z',
  knownProductIds: ['PROD-7'],
  availableContext: context(),
};

const ready = runAgent7ToS02(makeInput(), options);
assert.equal(ready.status, 'ready_for_S03');
assert.equal(ready.nextAction, 'continue_to_S03');
assert.equal(ready.canonicalEvent.source_agent, 'Agent-7');
assert.equal(ready.canonicalEvent.event_type, 'LOW_COVERAGE');
assert.equal(ready.canonicalEvent.product_id, 'PROD-7');
assert.equal(ready.canonicalEvent.metrics.available_units, 120);
assert.equal(ready.canonicalEvent.metrics.daily_units, 20);
assert.equal(ready.canonicalEvent.metrics.coverage_days, 6);
assert.equal(ready.canonicalEvent.metrics.lead_time_days, 8);
assert.equal(ready.canonicalEvent.metrics.safety_stock_days, 4);
assert.ok(ready.contextPackage);
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
  const blocked = runAgent7ToS02({ ...makeInput(), [key]: value }, options);
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.reasons.includes(`privilege_injection_${key}`));
  assert.equal(blocked.contextPackage, null);
  assert.equal(blocked.productionWriteAuthorized, false);
}

const missing = runAgent7ToS02(makeInput(), { ...options, availableContext: {} });
assert.notEqual(missing.nextAction, 'continue_to_S03');
assert.equal(missing.contextPackage, null);

const wrongProductContext = context();
wrongProductContext.C01 = loaded('C01');
wrongProductContext.C01.data.product_id = 'OTHER';
const wrongProduct = runAgent7ToS02(makeInput(), { ...options, availableContext: wrongProductContext });
assert.notEqual(wrongProduct.nextAction, 'continue_to_S03');

console.log('Agent-7 S01 to read-only S02 context runtime contract: PASS');
