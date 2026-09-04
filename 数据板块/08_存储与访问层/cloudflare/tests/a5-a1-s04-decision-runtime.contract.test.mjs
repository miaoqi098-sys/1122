import assert from 'node:assert/strict';
import { runAgent5ToS03 } from '../a5-a1-s03-runtime.js';
import { runAgent5ToS04DecisionFormation } from '../a5-a1-s04-decision-runtime.js';

function window({ id, start, end, sessions, freshness = 'fresh' }) {
  return { window_id:id, start_at:start, end_at:end, sessions, evidence_refs:[`evidence:${id}`], freshness };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A5-S04-DECISION-001',
    scope:{ scope_type:'product', scope_id:'PROD-5', product_id:'PROD-5', asin:'B0A5TEST01', marketplace:'US' },
    baseline_window:window({ id:'A5-W1', start:'2026-09-03T00:00:00.000Z', end:'2026-09-03T01:00:00.000Z', sessions:100 }),
    current_window:window({ id:'A5-W2', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', sessions:70 }),
    sample_comparable:true,
    sample_sufficient:true,
  };
}
function loaded(domain, event = null) {
  let data;
  if (domain === 'C01') data = { product_id:'PROD-5', asin:'B0A5TEST01', title:'Traffic Test Product' };
  else if (domain === 'C02') data = { current_state:{ traffic_state:'session_decline', observed_at:'2026-09-03T03:00:00.000Z' } };
  else if (domain === 'C03') data = { active_plan:{ primary_goal:'Diagnose traffic decline without production writes.' } };
  else if (domain === 'C05') data = { recent_events:event ? [event] : [] };
  else data = { domain, product_id:'PROD-5' };
  return {
    status:'loaded', freshness:'fresh', as_of:'2026-09-03T03:00:00.000Z',
    source:'simulated-contract-context', item_count:Array.isArray(data.recent_events) ? data.recent_events.length : 1,
    refs:[`test:${domain}:PROD-5`], data,
  };
}
function context(event = null) {
  return Object.fromEntries(Array.from({ length:10 },(_,i)=>`C${String(i+1).padStart(2,'0')}`).map((d)=>[d,loaded(d,event)]));
}
const baseOptions={ generatedAt:'2026-09-03T03:00:01.000Z', receivedAt:'2026-09-03T03:00:02.000Z', mappedAt:'2026-09-03T03:00:03.000Z', currentTime:'2026-09-03T03:00:04.000Z', knownProductIds:['PROD-5'] };

const probe=runAgent5ToS03(makeInput(), { ...baseOptions, availableContext:context() });
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

const ready=await runAgent5ToS04DecisionFormation(
  makeInput(),
  { ...baseOptions, availableContext:context(sourceEvent) },
);
assert.equal(ready.status,'decision_candidate_ready');
assert.equal(ready.nextAction,'continue_to_task_draft_generation');
assert.equal(ready.readOnly,true);
assert.equal(ready.approvalGranted,false);
assert.equal(ready.permissionGranted,false);
assert.equal(ready.taskAuthorized,false);
assert.equal(ready.executionAuthorized,false);
assert.equal(ready.dispatchAuthorized,false);
assert.equal(ready.productionWriteAuthorized,false);
assert.equal(ready.canonicalEvent.source_agent,'Agent-5');
assert.equal(ready.canonicalEvent.event_type,'traffic_session_decline');
assert.equal(ready.canonicalEvent.product_id,'PROD-5');
assert.equal(ready.canonicalEvent.metrics.baseline_window_id,'A5-W1');
assert.equal(ready.canonicalEvent.metrics.current_window_id,'A5-W2');
assert.equal(ready.priorityCandidate.status,'candidate_ready');
assert.equal(ready.priorityCandidate.decisionItemId,ready.decisionItem.decision_item_id);
assert.equal(ready.priorityResult.status,'ranking_ready');
assert.equal(ready.priorityResult.rankedDecisionItems.length,1);
assert.equal(ready.priorityResult.rankedDecisionItems[0].rank,1);
assert.equal(ready.formationResult.status,'formation_ready');
assert.equal(ready.decisionCandidate.decisionState,'candidate');
assert.equal(ready.decisionCandidate.readOnly,true);
assert.equal(ready.decisionCandidate.executionAuthorized,false);
assert.equal(ready.decisionCandidate.taskGenerationMode,'draft_only');
assert.equal(ready.decisionCandidate.decisionItemId,ready.decisionItem.decision_item_id);
assert.equal(ready.decisionCandidate.eventId,ready.canonicalEvent.event_id);

const missingSourceEvent=await runAgent5ToS04DecisionFormation(
  makeInput(),
  { ...baseOptions, availableContext:context() },
);
assert.equal(missingSourceEvent.status,'needs_information');
assert.equal(missingSourceEvent.decisionCandidate,null);
assert.equal(missingSourceEvent.executionAuthorized,false);
assert.equal(missingSourceEvent.dispatchAuthorized,false);
assert.equal(missingSourceEvent.taskAuthorized,false);

const forgedPrivilege=await runAgent5ToS04DecisionFormation(
  { ...makeInput(), taskAuthorized:true },
  { ...baseOptions, availableContext:context(sourceEvent) },
);
assert.equal(forgedPrivilege.status,'blocked');
assert.equal(forgedPrivilege.nextAction,'hold_for_review');
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_taskAuthorized'));
assert.equal(forgedPrivilege.decisionCandidate,null);
assert.equal(forgedPrivilege.readOnly,true);
assert.equal(forgedPrivilege.executionAuthorized,false);
assert.equal(forgedPrivilege.dispatchAuthorized,false);
assert.equal(forgedPrivilege.taskAuthorized,false);
assert.equal(forgedPrivilege.productionWriteAuthorized,false);

const staleInput=makeInput();
staleInput.current_window=window({ id:'A5-W2-STALE', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', sessions:70, freshness:'stale' });
const stale=await runAgent5ToS04DecisionFormation(
  staleInput,
  { ...baseOptions, availableContext:context(sourceEvent) },
);
assert.notEqual(stale.nextAction,'continue_to_task_draft_generation');
assert.equal(stale.decisionCandidate,null);
assert.equal(stale.executionAuthorized,false);
assert.equal(stale.dispatchAuthorized,false);

console.log('Agent-5 S04 read-only priority and decision formation contract: PASS');
