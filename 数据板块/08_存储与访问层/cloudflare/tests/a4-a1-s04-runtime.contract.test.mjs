import assert from 'node:assert/strict';
import { runAgent4ToS03 } from '../a4-a1-s03-runtime.js';
import { runAgent4ToS04 } from '../a4-a1-s04-runtime.js';

function window({ id, start, end, clicks, orders, spend, freshness = 'fresh' }) {
  return { window_id:id, start_at:start, end_at:end, clicks, attributed_orders:orders, spend, evidence_refs:[`evidence:${id}`], freshness };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A4-S04-001',
    scope:{ scope_type:'product', scope_id:'PROD-4', product_id:'PROD-4', asin:'B0A4TEST01', marketplace:'US' },
    entity:{ entity_type:'target', entity_id:'TARGET-001' },
    baseline_window:window({ id:'A4-W1', start:'2026-09-03T00:00:00.000Z', end:'2026-09-03T01:00:00.000Z', clicks:20, orders:3, spend:18.5 }),
    current_window:window({ id:'A4-W2', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', clicks:24, orders:0, spend:23.1 }),
    sample_sufficient:true,
  };
}
function loaded(domain, event = null) {
  let data;
  if (domain === 'C01') data = { product_id:'PROD-4', asin:'B0A4TEST01', title:'Advertising Test Product' };
  else if (domain === 'C02') data = { current_state:{ advertising_state:'conversion_breakdown', observed_at:'2026-09-03T03:00:00.000Z' } };
  else if (domain === 'C03') data = { active_plan:{ primary_goal:'Restore advertising conversion efficiency without production writes.' } };
  else if (domain === 'C05') data = { recent_events:event ? [event] : [] };
  else data = { domain, product_id:'PROD-4' };
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
  event_id:event.event_id, event_type:event.event_type, severity:event.severity,
  summary:event.summary, metrics:event.metrics, occurred_at:event.occurred_at,
  requires_decision_by:event.requires_decision_by ?? null,
};

const ready=await runAgent4ToS04(makeInput(), { ...baseOptions, availableContext:context(sourceEvent) });
assert.equal(ready.status,'ready_for_S04_decision_logic');
assert.equal(ready.nextAction,'continue_to_S04_decision_logic');
assert.equal(ready.readOnly,true);
assert.equal(ready.executionAuthorized,false);
assert.equal(ready.dispatchAuthorized,false);
assert.equal(ready.canonicalEvent.source_agent,'Agent-4');
assert.equal(ready.canonicalEvent.event_type,'advertising_conversion_breakdown');
assert.equal(ready.canonicalEvent.product_id,'PROD-4');
assert.equal(ready.canonicalEvent.metrics.entity_id,'TARGET-001');
assert.equal(ready.canonicalEvent.metrics.baseline_window_id,'A4-W1');
assert.equal(ready.canonicalEvent.metrics.current_window_id,'A4-W2');
assert.equal(ready.s04Result.status,'ready');
assert.equal(ready.s04Result.eligible,true);
assert.equal(ready.s04Result.nextAction,'continue_to_S04');
assert.equal(ready.s04Result.eventId,ready.canonicalEvent.event_id);
assert.equal(ready.s04Result.decisionItemId,ready.decisionItem.decision_item_id);
assert.ok(ready.decisionItem.source_event_refs.includes(ready.canonicalEvent.event_id));

const missingSourceEvent=await runAgent4ToS04(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(missingSourceEvent.status,'needs_information');
assert.equal(missingSourceEvent.nextAction,'request_more_context');
assert.equal(missingSourceEvent.s04Result,null);
assert.equal(missingSourceEvent.executionAuthorized,false);
assert.equal(missingSourceEvent.dispatchAuthorized,false);

const forgedPrivilege=await runAgent4ToS04(
  { ...makeInput(), dispatchAuthorized:true },
  { ...baseOptions, availableContext:context(sourceEvent) },
);
assert.equal(forgedPrivilege.status,'blocked');
assert.equal(forgedPrivilege.nextAction,'hold_for_review');
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_dispatchAuthorized'));
assert.equal(forgedPrivilege.s04Result,null);
assert.equal(forgedPrivilege.readOnly,true);
assert.equal(forgedPrivilege.executionAuthorized,false);
assert.equal(forgedPrivilege.dispatchAuthorized,false);

const staleInput=makeInput();
staleInput.current_window=window({ id:'A4-W2-STALE', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', clicks:24, orders:0, spend:23.1, freshness:'stale' });
const stale=await runAgent4ToS04(staleInput, { ...baseOptions, availableContext:context(sourceEvent) });
assert.notEqual(stale.nextAction,'continue_to_S04_decision_logic');
assert.equal(stale.s04Result,null);
assert.equal(stale.executionAuthorized,false);
assert.equal(stale.dispatchAuthorized,false);

const wrongEntity=makeInput();
wrongEntity.entity={ entity_type:'target', entity_id:'TARGET-FORGED' };
const entityMismatch=await runAgent4ToS04(wrongEntity, { ...baseOptions, availableContext:context(sourceEvent) });
assert.notEqual(entityMismatch.nextAction,'continue_to_S04_decision_logic');
assert.equal(entityMismatch.s04Result,null);
assert.equal(entityMismatch.executionAuthorized,false);
assert.equal(entityMismatch.dispatchAuthorized,false);

console.log('Agent-4 DecisionItem to fail-closed S04 runtime contract: PASS');
