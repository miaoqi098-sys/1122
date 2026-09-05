import assert from 'node:assert/strict';
import { runAgent7ToS03 } from '../a7-a1-s03-runtime.js';

function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A7-S03-001',
    scope:{ scope_type:'product', scope_id:'PROD-7', product_id:'PROD-7', asin:'B0A7TEST01', marketplace:'US' },
    inventory_snapshot:{ snapshot_id:'INV-A7-S03-001', observed_at:'2026-09-04T22:00:00.000Z', available_units:120, freshness:'fresh' },
    demand_baseline:{ baseline_id:'DEMAND-A7-S03-001', daily_units:20, freshness:'fresh' },
    lead_time_days:8, safety_stock_days:4,
    evidence_refs:['sim://inventory/PROD-7/INV-A7-S03-001','sim://demand/PROD-7/DEMAND-A7-S03-001'],
  };
}
function loaded(domain) {
  let data;
  if (domain === 'C01') data={ product_id:'PROD-7', asin:'B0A7TEST01', title:'Inventory Test Product' };
  else if (domain === 'C02') data={ current_state:{ inventory_state:'low_coverage', observed_at:'2026-09-04T22:00:00.000Z' } };
  else if (domain === 'C03') data={ active_plan:{ primary_goal:'Assess supply risk without inventory writes.' } };
  else data={ domain, product_id:'PROD-7' };
  return { status:'loaded', freshness:'fresh', as_of:'2026-09-04T22:00:00.000Z', source:'simulated-contract-context', item_count:1, refs:[`test:${domain}:PROD-7`], data };
}
const availableContext=Object.fromEntries(Array.from({ length:10 },(_,i)=>`C${String(i+1).padStart(2,'0')}`).map((d)=>[d,loaded(d)]));
const options={ generatedAt:'2026-09-04T22:00:01.000Z', receivedAt:'2026-09-04T22:00:02.000Z', mappedAt:'2026-09-04T22:00:03.000Z', currentTime:'2026-09-04T22:00:04.000Z', knownProductIds:['PROD-7'], availableContext };

const ready=runAgent7ToS03(makeInput(), options);
assert.equal(ready.readOnly,true);
assert.equal(ready.approvalGranted,false);
assert.equal(ready.permissionGranted,false);
assert.equal(ready.taskAuthorized,false);
assert.equal(ready.executionAuthorized,false);
assert.equal(ready.dispatchAuthorized,false);
assert.equal(ready.productionWriteAuthorized,false);
assert.equal(ready.canonicalEvent.source_agent,'Agent-7');
assert.equal(ready.canonicalEvent.event_type,'LOW_COVERAGE');
assert.equal(ready.canonicalEvent.product_id,'PROD-7');
assert.equal(ready.canonicalEvent.metrics.available_units,120);
assert.equal(ready.canonicalEvent.metrics.daily_units,20);
assert.equal(ready.canonicalEvent.metrics.coverage_days,6);
assert.equal(ready.canonicalEvent.metrics.lead_time_days,8);
assert.equal(ready.canonicalEvent.metrics.safety_stock_days,4);
assert.equal(ready.s03Result.event_id,ready.canonicalEvent.event_id);
assert.equal(ready.s03Result.scope.scope_type,'product');
assert.equal(ready.s03Result.scope.scope_id,'PROD-7');
assert.equal(ready.s03Result.scope.product_id,'PROD-7');
assert.ok(['continue_to_decision_item_builder','hold_for_review','request_evidence','send_to_S10','request_agent_review'].includes(ready.nextAction));
if (ready.nextAction === 'continue_to_decision_item_builder') assert.equal(ready.status,'ready_for_decision_item_builder');

for (const [key,value] of [
  ['approvalGranted',true],['permissionGranted',true],['taskAuthorized',true],['executionAuthorized',true],
  ['dispatchAuthorized',true],['productionWriteAuthorized',true],['purchaseOrder',{ units:10 }],
  ['transferOrder',{ units:10 }],['removalOrder',{ units:10 }],
]) {
  const blocked=runAgent7ToS03({ ...makeInput(), [key]:value }, options);
  assert.equal(blocked.status,'blocked');
  assert.ok(blocked.reasons.includes(`privilege_injection_${key}`));
  assert.equal(blocked.s03Result,null);
  assert.equal(blocked.productionWriteAuthorized,false);
}

const unknownProduct=runAgent7ToS03(makeInput(), { ...options, knownProductIds:['OTHER'] });
assert.equal(unknownProduct.status,'blocked');
assert.notEqual(unknownProduct.nextAction,'continue_to_decision_item_builder');
assert.equal(unknownProduct.s03Result,null);

const wrongProductContext={ ...availableContext, C01:{ ...availableContext.C01, data:{ ...availableContext.C01.data, product_id:'OTHER' } } };
const wrongProduct=runAgent7ToS03(makeInput(), { ...options, availableContext:wrongProductContext });
assert.equal(wrongProduct.status,'blocked');
assert.notEqual(wrongProduct.nextAction,'continue_to_decision_item_builder');
assert.equal(wrongProduct.s03Result,null);

console.log('Agent-7 S02 to read-only S03 conflict runtime contract: PASS');
