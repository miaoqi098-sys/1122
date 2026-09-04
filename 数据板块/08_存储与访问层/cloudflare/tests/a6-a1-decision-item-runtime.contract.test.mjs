import assert from 'node:assert/strict';
import { runAgent6ToS03 } from '../a6-a1-s03-runtime.js';
import { runAgent6ToDecisionItem } from '../a6-a1-decision-item-runtime.js';

function window({ id, start, end, revenue, profit, margin, freshness='fresh', costModel='COST-V1', currency='USD', costComplete=true }) {
  return { window_id:id, start_at:start, end_at:end, revenue, contribution_profit:profit, contribution_margin_pct:margin, currency, cost_model_version:costModel, cost_complete:costComplete, freshness, evidence_refs:[`evidence:${id}:orders`,`evidence:${id}:costs`] };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A6-DI-001',
    scope:{ scope_type:'product', scope_id:'PROD-6', product_id:'PROD-6', asin:'B0A6TEST01', marketplace:'US' },
    baseline_window:window({ id:'A6-W1', start:'2026-09-03T00:00:00.000Z', end:'2026-09-03T01:00:00.000Z', revenue:1000, profit:250, margin:0.25 }),
    current_window:window({ id:'A6-W2', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', revenue:1000, profit:170, margin:0.17 }),
    sample_comparable:true, sample_sufficient:true,
  };
}
function loaded(domain, event=null) {
  let data;
  if (domain === 'C01') data={ product_id:'PROD-6', asin:'B0A6TEST01', title:'Finance Test Product' };
  else if (domain === 'C02') data={ current_state:{ financial_state:'margin_compression', observed_at:'2026-09-03T03:00:00.000Z' } };
  else if (domain === 'C03') data={ active_plan:{ primary_goal:'Protect contribution margin without production writes.' } };
  else if (domain === 'C05') data={ recent_events:event ? [event] : [] };
  else data={ domain, product_id:'PROD-6' };
  return { status:'loaded', freshness:'fresh', as_of:'2026-09-03T03:00:00.000Z', source:'simulated-contract-context', item_count:Array.isArray(data.recent_events) ? data.recent_events.length : 1, refs:[`test:${domain}:PROD-6`], data };
}
function context(event=null) {
  return Object.fromEntries(Array.from({ length:10 },(_,i)=>`C${String(i+1).padStart(2,'0')}`).map((d)=>[d,loaded(d,event)]));
}
const baseOptions={ generatedAt:'2026-09-03T03:00:01.000Z', receivedAt:'2026-09-03T03:00:02.000Z', mappedAt:'2026-09-03T03:00:03.000Z', currentTime:'2026-09-03T03:00:04.000Z', knownProductIds:['PROD-6'] };

const probe=runAgent6ToS03(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(probe.status,'ready_for_decision_item_builder');
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
const options={ ...baseOptions, availableContext:context(sourceEvent) };

const ready=runAgent6ToDecisionItem(makeInput(), options);
assert.equal(ready.status,'ready_for_S04');
assert.equal(ready.nextAction,'continue_to_S04');
assert.equal(ready.readOnly,true);
assert.equal(ready.approvalGranted,false);
assert.equal(ready.permissionGranted,false);
assert.equal(ready.taskAuthorized,false);
assert.equal(ready.executionAuthorized,false);
assert.equal(ready.dispatchAuthorized,false);
assert.equal(ready.productionWriteAuthorized,false);
assert.equal(ready.canonicalEvent.source_agent,'Agent-6');
assert.equal(ready.canonicalEvent.event_type,'MARGIN_COMPRESSION');
assert.equal(ready.canonicalEvent.product_id,'PROD-6');
assert.equal(ready.canonicalEvent.metrics.baseline_window_id,'A6-W1');
assert.equal(ready.canonicalEvent.metrics.current_window_id,'A6-W2');
assert.equal(ready.canonicalEvent.metrics.cost_model_version,'COST-V1');
assert.equal(ready.canonicalEvent.metrics.currency,'USD');
assert.ok(Array.isArray(ready.decisionItems));
assert.ok(ready.decisionItems.length>0);
for (const item of ready.decisionItems) {
  assert.ok(Array.isArray(item.source_event_refs));
  assert.ok(item.source_event_refs.includes(ready.canonicalEvent.event_id));
}
assert.equal(ready.builderResult.next_action,'continue_to_S04');
assert.equal(ready.s03BridgeResult.nextAction,'continue_to_decision_item_builder');
assert.equal(ready.s03BridgeResult.s03Result.event_id,ready.canonicalEvent.event_id);

const forged=runAgent6ToDecisionItem({ ...makeInput(), taskAuthorized:true }, options);
assert.equal(forged.status,'blocked');
assert.equal(forged.nextAction,'hold_for_review');
assert.ok(forged.reasons.includes('privilege_injection_taskAuthorized'));
assert.deepEqual(forged.decisionItems,[]);
assert.equal(forged.readOnly,true);
assert.equal(forged.taskAuthorized,false);
assert.equal(forged.executionAuthorized,false);
assert.equal(forged.productionWriteAuthorized,false);

const unknownProduct=runAgent6ToDecisionItem(makeInput(), { ...options, knownProductIds:['OTHER'] });
assert.equal(unknownProduct.status,'blocked');
assert.notEqual(unknownProduct.nextAction,'continue_to_S04');
assert.deepEqual(unknownProduct.decisionItems,[]);

const missingContext=runAgent6ToDecisionItem(makeInput(), { generatedAt:baseOptions.generatedAt, receivedAt:baseOptions.receivedAt, mappedAt:baseOptions.mappedAt, currentTime:baseOptions.currentTime, knownProductIds:baseOptions.knownProductIds });
assert.equal(missingContext.status,'blocked');
assert.equal(missingContext.nextAction,'hold_for_review');
assert.deepEqual(missingContext.decisionItems,[]);

const missingSourceEvent=runAgent6ToDecisionItem(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(missingSourceEvent.status,'needs_information');
assert.equal(missingSourceEvent.nextAction,'request_more_context');
assert.deepEqual(missingSourceEvent.decisionItems,[]);
assert.equal(missingSourceEvent.readOnly,true);
assert.equal(missingSourceEvent.executionAuthorized,false);
assert.equal(missingSourceEvent.productionWriteAuthorized,false);

console.log('Agent-6 S03 to DecisionItemBuilder read-only contract: PASS');
