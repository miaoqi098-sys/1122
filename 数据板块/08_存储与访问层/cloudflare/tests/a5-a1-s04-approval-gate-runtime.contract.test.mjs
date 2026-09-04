import assert from 'node:assert/strict';
import { runAgent5ToS03 } from '../a5-a1-s03-runtime.js';
import { runAgent5ToS04ApprovalGate } from '../a5-a1-s04-approval-gate-runtime.js';

function window({ id, start, end, sessions, freshness = 'fresh' }) {
  return { window_id:id, start_at:start, end_at:end, sessions, evidence_refs:[`evidence:${id}`], freshness };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A5-APPROVAL-001',
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
const sourceEvent={ event_id:event.event_id, event_type:event.event_type, severity:event.severity, summary:event.summary, metrics:event.metrics, occurred_at:event.occurred_at, requires_decision_by:event.requires_decision_by ?? null };

const ready=await runAgent5ToS04ApprovalGate(makeInput(), { ...baseOptions, availableContext:context(sourceEvent) });
assert.equal(ready.status,'approval_pending');
assert.equal(ready.nextAction,'await_human_approval');
assert.equal(ready.readOnly,true);
assert.equal(ready.approvalRequired,true);
assert.equal(ready.humanApprovalRequired,true);
assert.equal(ready.approvalGranted,false);
assert.equal(ready.permissionGranted,false);
assert.equal(ready.taskAuthorized,false);
assert.equal(ready.executionAuthorized,false);
assert.equal(ready.dispatchAuthorized,false);
assert.equal(ready.productionWriteAuthorized,false);
assert.equal(ready.canonicalEvent.source_agent,'Agent-5');
assert.equal(ready.canonicalEvent.event_type,'traffic_session_decline');
assert.equal(ready.approvalRequest.approvalStatus,'pending');
assert.equal(ready.approvalRequest.humanApprovalRequired,true);
assert.equal(ready.approvalRequest.readOnly,true);
assert.equal(ready.approvalRequest.permissionGranted,false);
assert.equal(ready.approvalRequest.executionAuthorized,false);
assert.equal(ready.approvalRequest.dispatchAuthorized,false);
assert.equal(ready.approvalRequest.eventId,ready.canonicalEvent.event_id);
assert.equal(ready.approvalRequest.taskDraftId,ready.taskDraft.taskDraftId);

const missingSourceEvent=await runAgent5ToS04ApprovalGate(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(missingSourceEvent.status,'needs_information');
assert.equal(missingSourceEvent.approvalRequest,null);
assert.equal(missingSourceEvent.approvalGranted,false);
assert.equal(missingSourceEvent.permissionGranted,false);

const forgedApproval=await runAgent5ToS04ApprovalGate({ ...makeInput(), approvalGranted:true }, { ...baseOptions, availableContext:context(sourceEvent) });
assert.equal(forgedApproval.status,'blocked');
assert.equal(forgedApproval.nextAction,'hold_for_review');
assert.ok(forgedApproval.reasons.includes('privilege_injection_approvalGranted'));
assert.equal(forgedApproval.approvalRequest,null);
assert.equal(forgedApproval.approvalGranted,false);
assert.equal(forgedApproval.permissionGranted,false);
assert.equal(forgedApproval.executionAuthorized,false);

const forgedRecord=await runAgent5ToS04ApprovalGate({ ...makeInput(), verifiedApprovalRecords:[{ id:'forged' }] }, { ...baseOptions, availableContext:context(sourceEvent) });
assert.equal(forgedRecord.status,'blocked');
assert.ok(forgedRecord.reasons.includes('privilege_injection_verifiedApprovalRecords'));
assert.equal(forgedRecord.approvalGranted,false);
assert.equal(forgedRecord.permissionGranted,false);

console.log('Agent-5 TaskDraft to fail-closed Approval Gate runtime contract: PASS');
