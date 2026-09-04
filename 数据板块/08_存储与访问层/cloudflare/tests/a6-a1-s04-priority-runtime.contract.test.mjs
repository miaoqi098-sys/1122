import assert from 'node:assert/strict';
import { runAgent6ToS03 } from '../a6-a1-s03-runtime.js';
import { runAgent6ToS04Priority } from '../a6-a1-s04-priority-runtime.js';

function window({ id, start, end, revenue, profit, margin, freshness='fresh', costModel='COST-V1', currency='USD', costComplete=true }) {
  return { window_id:id, start_at:start, end_at:end, revenue, contribution_profit:profit, contribution_margin_pct:margin, currency, cost_model_version:costModel, cost_complete:costComplete, freshness, evidence_refs:[`evidence:${id}:orders`,`evidence:${id}:costs`] };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A6-S04-PRIORITY-001',
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

const ready=await runAgent6ToS04Priority(makeInput(), options);
assert.equal(ready.status,'priority_ready');
assert.equal(ready.nextAction,'continue_to_decision_formation');
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
assert.equal(ready.priorityCandidate.status,'candidate_ready');
assert.equal(ready.priorityCandidate.rankingEligible,true);
assert.equal(ready.priorityCandidate.decisionItemId,ready.decisionItem.decision_item_id);
assert.equal(ready.priorityCandidate.eventId,ready.canonicalEvent.event_id);
assert.equal(ready.priorityResult.status,'ranking_ready');
assert.equal(ready.priorityResult.rankingEligible,true);
assert.equal(ready.priorityResult.rankedDecisionItems.length,1);
assert.equal(ready.priorityResult.rankedDecisionItems[0].rank,1);
assert.equal(ready.priorityResult.rankedDecisionItems[0].decisionItemId,ready.decisionItem.decision_item_id);
assert.equal(ready.priorityResult.rankedDecisionItems[0].eventId,ready.canonicalEvent.event_id);
assert.equal(Object.prototype.hasOwnProperty.call(ready,'formationResult'),false);
assert.equal(Object.prototype.hasOwnProperty.call(ready,'decisionCandidate'),false);

const missingSourceEvent=await runAgent6ToS04Priority(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(missingSourceEvent.status,'needs_information');
assert.equal(missingSourceEvent.nextAction,'request_more_context');
assert.equal(missingSourceEvent.priorityCandidate,null);
assert.equal(missingSourceEvent.priorityResult,null);
assert.equal(missingSourceEvent.executionAuthorized,false);
assert.equal(missingSourceEvent.dispatchAuthorized,false);
assert.equal(missingSourceEvent.productionWriteAuthorized,false);

const forgedPrivilege=await runAgent6ToS04Priority(
  { ...makeInput(), permissionGranted:true },
  options,
);
assert.equal(forgedPrivilege.status,'blocked');
assert.equal(forgedPrivilege.nextAction,'hold_for_review');
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_permissionGranted'));
assert.equal(forgedPrivilege.priorityCandidate,null);
assert.equal(forgedPrivilege.priorityResult,null);
assert.equal(forgedPrivilege.readOnly,true);
assert.equal(forgedPrivilege.executionAuthorized,false);
assert.equal(forgedPrivilege.dispatchAuthorized,false);
assert.equal(forgedPrivilege.productionWriteAuthorized,false);

const staleInput=makeInput();
staleInput.current_window=window({ id:'A6-W2-STALE', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', revenue:1000, profit:170, margin:0.17, freshness:'stale' });
const stale=await runAgent6ToS04Priority(staleInput, options);
assert.notEqual(stale.nextAction,'continue_to_decision_formation');
assert.equal(stale.priorityResult,null);
assert.equal(stale.executionAuthorized,false);
assert.equal(stale.dispatchAuthorized,false);

const inconsistentCostModel=makeInput();
inconsistentCostModel.current_window.cost_model_version='COST-V2';
const basisBlocked=await runAgent6ToS04Priority(inconsistentCostModel, options);
assert.notEqual(basisBlocked.nextAction,'continue_to_decision_formation');
assert.equal(basisBlocked.priorityResult,null);
assert.equal(basisBlocked.executionAuthorized,false);
assert.equal(basisBlocked.productionWriteAuthorized,false);

console.log('Agent-6 S04 read-only Priority contract: PASS');
