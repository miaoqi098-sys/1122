import assert from 'node:assert/strict';
import { runAgent4ToS03 } from '../a4-a1-s03-runtime.js';
import { runAgent4ToDecisionItem } from '../a4-a1-decision-item-runtime.js';

function window({ id, start, end, clicks, orders, spend, freshness = 'fresh' }) {
  return { window_id:id, start_at:start, end_at:end, clicks, attributed_orders:orders, spend, evidence_refs:[`evidence:${id}`], freshness };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A4-DI-001',
    scope:{ scope_type:'product', scope_id:'PROD-4', product_id:'PROD-4', asin:'B0A4TEST01', marketplace:'US' },
    entity:{ entity_type:'target', entity_id:'TARGET-001' },
    baseline_window:window({ id:'A4-W1', start:'2026-09-03T00:00:00.000Z', end:'2026-09-03T01:00:00.000Z', clicks:20, orders:3, spend:18.5 }),
    current_window:window({ id:'A4-W2', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', clicks:24, orders:0, spend:23.1 }),
    sample_sufficient:true,
  };
}
function loaded(domain, event = null) {
  let data;
  if (domain === 'C01') {
    data = { product_id:'PROD-4', asin:'B0A4TEST01', title:'Advertising Test Product' };
  } else if (domain === 'C02') {
    data = { current_state:{ advertising_state:'conversion_breakdown', observed_at:'2026-09-03T03:00:00.000Z' } };
  } else if (domain === 'C03') {
    data = { active_plan:{ primary_goal:'Restore advertising conversion efficiency without production writes.' } };
  } else if (domain === 'C05') {
    data = { recent_events:event ? [event] : [] };
  } else {
    data = { domain, product_id:'PROD-4' };
  }
  return {
    status:'loaded', freshness:'fresh', as_of:'2026-09-03T03:00:00.000Z',
    source:'simulated-contract-context', item_count:Array.isArray(data.recent_events) ? data.recent_events.length : 1,
    refs:[`test:${domain}:PROD-4`], data,
  };
}
function context(event = null) {
  return Object.fromEntries(Array.from({ length:10 },(_,i)=>`C${String(i+1).padStart(2,'0')}`).map((d)=>[d,loaded(d,event)]));
}
const baseOptions={ generatedAt:'2026-09-03T03:00:01.000Z', receivedAt:'2026-09-03T03:00:02.000Z', mappedAt:'2026-09-03T03:00:03.000Z', currentTime:'2026-09-03T03:00:04.000Z', knownProductIds:['PROD-4'] };

const probe=runAgent4ToS03(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(probe.canonicalEvent.source_agent,'Agent-4');
const event=probe.canonicalEvent;
const sourceEvent={
  event_id:event.event_id,
  event_type:event.event_type,
  severity:event.severity,
  summary:event.summary,
  metrics:event.metrics,
  occurred_at:event.occurred_at,
  requires_decision_by:event.requires_decision_by ?? null,
};

const ready=runAgent4ToDecisionItem(makeInput(), { ...baseOptions, availableContext:context(sourceEvent) });
assert.equal(ready.status,'ready_for_S04');
assert.equal(ready.nextAction,'continue_to_S04');
assert.equal(ready.readOnly,true);
assert.equal(ready.executionAuthorized,false);
assert.equal(ready.dispatchAuthorized,false);
assert.equal(ready.canonicalEvent.source_agent,'Agent-4');
assert.equal(ready.canonicalEvent.event_type,'advertising_conversion_breakdown');
assert.equal(ready.canonicalEvent.product_id,'PROD-4');
assert.equal(ready.canonicalEvent.metrics.entity_id,'TARGET-001');
assert.equal(ready.canonicalEvent.metrics.baseline_window_id,'A4-W1');
assert.equal(ready.canonicalEvent.metrics.current_window_id,'A4-W2');
assert.equal(ready.builderResult.next_action,'continue_to_S04');
assert.equal(ready.decisionItems.length,1);
assert.ok(ready.decisionItems[0].source_event_refs.includes(ready.canonicalEvent.event_id));

const missingSourceEvent=runAgent4ToDecisionItem(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(missingSourceEvent.status,'needs_information');
assert.equal(missingSourceEvent.nextAction,'request_more_context');
assert.equal(missingSourceEvent.decisionItems.length,0);
assert.equal(missingSourceEvent.executionAuthorized,false);
assert.equal(missingSourceEvent.dispatchAuthorized,false);

const forged=runAgent4ToDecisionItem({ ...makeInput(), dispatchAuthorized:true }, { ...baseOptions, availableContext:context(sourceEvent) });
assert.equal(forged.status,'blocked');
assert.equal(forged.nextAction,'hold_for_review');
assert.equal(forged.decisionItems.length,0);
assert.equal(forged.executionAuthorized,false);
assert.equal(forged.dispatchAuthorized,false);

const wrongEntity=makeInput();
wrongEntity.entity={ entity_type:'target', entity_id:'TARGET-FORGED' };
const entityMismatch=runAgent4ToDecisionItem(wrongEntity, { ...baseOptions, availableContext:context(sourceEvent) });
assert.notEqual(entityMismatch.nextAction,'continue_to_S04');
assert.equal(entityMismatch.decisionItems.length,0);
assert.equal(entityMismatch.executionAuthorized,false);
assert.equal(entityMismatch.dispatchAuthorized,false);

const insufficient=makeInput(); insufficient.sample_sufficient=false;
const notReady=runAgent4ToDecisionItem(insufficient, { ...baseOptions, availableContext:context(sourceEvent) });
assert.equal(notReady.status,'needs_confirmation');
assert.equal(notReady.nextAction,'observe');
assert.equal(notReady.decisionItems.length,0);

console.log('Agent-4 S03 to DecisionItemBuilder runtime contract: PASS');
