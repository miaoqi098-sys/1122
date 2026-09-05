import assert from 'node:assert/strict';
import { runAgent7ToS03 } from '../a7-a1-s03-runtime.js';
import { runAgent7ToDecisionItem } from '../a7-a1-decision-item-runtime.js';

function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A7-DI-001',
    scope:{ scope_type:'product', scope_id:'PROD-7', product_id:'PROD-7', asin:'B0A7TEST01', marketplace:'US' },
    inventory_snapshot:{ snapshot_id:'INV-A7-DI-001', observed_at:'2026-09-04T22:00:00.000Z', available_units:120, freshness:'fresh' },
    demand_baseline:{ baseline_id:'DEMAND-A7-DI-001', daily_units:20, freshness:'fresh' },
    lead_time_days:8, safety_stock_days:4,
    evidence_refs:['sim://inventory/PROD-7/INV-A7-DI-001','sim://demand/PROD-7/DEMAND-A7-DI-001'],
  };
}
function loaded(domain, event=null) {
  let data;
  if (domain === 'C01') data={ product_id:'PROD-7', asin:'B0A7TEST01', title:'Inventory Test Product' };
  else if (domain === 'C02') data={ current_state:{ inventory_state:'low_coverage', observed_at:'2026-09-04T22:00:00.000Z' } };
  else if (domain === 'C03') data={ active_plan:{ primary_goal:'Assess supply risk without inventory writes.' } };
  else if (domain === 'C05') data={ recent_events:event ? [event] : [] };
  else data={ domain, product_id:'PROD-7' };
  return { status:'loaded', freshness:'fresh', as_of:'2026-09-04T22:00:00.000Z', source:'simulated-contract-context', item_count:Array.isArray(data.recent_events) ? data.recent_events.length : 1, refs:[`test:${domain}:PROD-7`], data };
}
function context(event=null) {
  return Object.fromEntries(Array.from({ length:10 },(_,i)=>`C${String(i+1).padStart(2,'0')}`).map((d)=>[d,loaded(d,event)]));
}
const baseOptions={ generatedAt:'2026-09-04T22:00:01.000Z', receivedAt:'2026-09-04T22:00:02.000Z', mappedAt:'2026-09-04T22:00:03.000Z', currentTime:'2026-09-04T22:00:04.000Z', knownProductIds:['PROD-7'] };
const probe=runAgent7ToS03(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(probe.status,'ready_for_decision_item_builder');
const event=probe.canonicalEvent;
const sourceEvent={ event_id:event.event_id, event_type:event.event_type, severity:event.severity, summary:event.summary, metrics:event.metrics, occurred_at:event.occurred_at, requires_decision_by:event.requires_decision_by ?? null };
const options={ ...baseOptions, availableContext:context(sourceEvent) };

const ready=runAgent7ToDecisionItem(makeInput(), options);
assert.equal(ready.status,'ready_for_S04');
assert.equal(ready.nextAction,'continue_to_S04');
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
assert.ok(Array.isArray(ready.decisionItems));
assert.ok(ready.decisionItems.length>0);
for (const item of ready.decisionItems) {
  assert.ok(Array.isArray(item.source_event_refs));
  assert.ok(item.source_event_refs.includes(ready.canonicalEvent.event_id));
}
assert.equal(ready.builderResult.next_action,'continue_to_S04');
assert.equal(ready.s03BridgeResult.nextAction,'continue_to_decision_item_builder');

for (const [key,value] of [
  ['approvalGranted',true],['permissionGranted',true],['taskAuthorized',true],['executionAuthorized',true],
  ['dispatchAuthorized',true],['productionWriteAuthorized',true],['purchaseOrder',{ units:10 }],
  ['transferOrder',{ units:10 }],['removalOrder',{ units:10 }],
]) {
  const blocked=runAgent7ToDecisionItem({ ...makeInput(), [key]:value }, options);
  assert.equal(blocked.status,'blocked');
  assert.ok(blocked.reasons.includes(`privilege_injection_${key}`));
  assert.deepEqual(blocked.decisionItems,[]);
  assert.equal(blocked.productionWriteAuthorized,false);
}

const unknownProduct=runAgent7ToDecisionItem(makeInput(), { ...options, knownProductIds:['OTHER'] });
assert.equal(unknownProduct.status,'blocked');
assert.notEqual(unknownProduct.nextAction,'continue_to_S04');
assert.deepEqual(unknownProduct.decisionItems,[]);

const missingSourceEvent=runAgent7ToDecisionItem(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(missingSourceEvent.status,'needs_information');
assert.equal(missingSourceEvent.nextAction,'request_more_context');
assert.deepEqual(missingSourceEvent.decisionItems,[]);
assert.equal(missingSourceEvent.readOnly,true);
assert.equal(missingSourceEvent.executionAuthorized,false);
assert.equal(missingSourceEvent.productionWriteAuthorized,false);

console.log('Agent-7 S03 to DecisionItemBuilder read-only contract: PASS');
