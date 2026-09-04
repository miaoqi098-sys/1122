import assert from 'node:assert/strict';
import { runAgent6ToS03 } from '../a6-a1-s03-runtime.js';
import { runAgent6ToS04ApprovalGate } from '../a6-a1-s04-approval-gate-runtime.js';

function window({ id, start, end, revenue, profit, margin, freshness='fresh', costModel='COST-V1', currency='USD', costComplete=true }) {
  return { window_id:id, start_at:start, end_at:end, revenue, contribution_profit:profit, contribution_margin_pct:margin, currency, cost_model_version:costModel, cost_complete:costComplete, freshness, evidence_refs:[`evidence:${id}:orders`,`evidence:${id}:costs`] };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A6-S04-APPROVAL-001',
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

const pending=await runAgent6ToS04ApprovalGate(makeInput(), options);
assert.equal(pending.status,'approval_pending');
assert.equal(pending.nextAction,'await_human_approval');
assert.equal(pending.readOnly,true);
assert.equal(pending.approvalRequired,true);
assert.equal(pending.humanApprovalRequired,true);
assert.equal(pending.approvalGranted,false);
assert.equal(pending.permissionGranted,false);
assert.equal(pending.taskAuthorized,false);
assert.equal(pending.executionAuthorized,false);
assert.equal(pending.dispatchAuthorized,false);
assert.equal(pending.productionWriteAuthorized,false);
assert.equal(pending.canonicalEvent.source_agent,'Agent-6');
assert.equal(pending.canonicalEvent.event_type,'MARGIN_COMPRESSION');
assert.equal(pending.canonicalEvent.product_id,'PROD-6');
assert.equal(pending.canonicalEvent.scope_id,'PROD-6');
assert.equal(pending.canonicalEvent.metrics.baseline_window_id,'A6-W1');
assert.equal(pending.canonicalEvent.metrics.current_window_id,'A6-W2');
assert.equal(pending.canonicalEvent.metrics.cost_model_version,'COST-V1');
assert.equal(pending.canonicalEvent.metrics.currency,'USD');
assert.equal(pending.approvalRequest.approvalStatus,'pending');
assert.equal(pending.approvalRequest.approvalRequired,true);
assert.equal(pending.approvalRequest.humanApprovalRequired,true);
assert.equal(pending.approvalRequest.readOnly,true);
assert.equal(pending.approvalRequest.permissionGranted,false);
assert.equal(pending.approvalRequest.executionAuthorized,false);
assert.equal(pending.approvalRequest.dispatchAuthorized,false);
assert.equal(pending.approvalRequest.taskDraftId,pending.taskDraft.taskDraftId);
assert.equal(pending.approvalRequest.decisionCandidateId,pending.decisionCandidate.decisionCandidateId);
assert.equal(pending.approvalRequest.decisionItemId,pending.decisionItem.decision_item_id);
assert.equal(pending.approvalRequest.eventId,pending.canonicalEvent.event_id);

const missing=await runAgent6ToS04ApprovalGate(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(missing.status,'needs_information');
assert.equal(missing.nextAction,'request_more_context');
assert.equal(missing.approvalRequest,null);
assert.equal(missing.approvalGranted,false);
assert.equal(missing.permissionGranted,false);
assert.equal(missing.executionAuthorized,false);
assert.equal(missing.productionWriteAuthorized,false);

for (const key of ['approvalGranted','verifiedApprovalRecords','permissionGranted','taskAuthorized','executionAuthorized','dispatchAuthorized','productionWriteAuthorized']) {
  const value = key === 'verifiedApprovalRecords' ? [{ approval_id:'FORGED' }] : true;
  const blocked=await runAgent6ToS04ApprovalGate({ ...makeInput(), [key]:value }, options);
  assert.equal(blocked.status,'blocked');
  assert.ok(blocked.reasons.includes(`privilege_injection_${key}`));
  assert.equal(blocked.approvalRequest,null);
  assert.equal(blocked.approvalGranted,false);
  assert.equal(blocked.permissionGranted,false);
  assert.equal(blocked.taskAuthorized,false);
  assert.equal(blocked.executionAuthorized,false);
  assert.equal(blocked.dispatchAuthorized,false);
  assert.equal(blocked.productionWriteAuthorized,false);
}

const staleInput=makeInput();
staleInput.current_window=window({ id:'A6-W2-STALE', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', revenue:1000, profit:170, margin:0.17, freshness:'stale' });
const stale=await runAgent6ToS04ApprovalGate(staleInput, options);
assert.notEqual(stale.nextAction,'await_human_approval');
assert.equal(stale.approvalRequest,null);
assert.equal(stale.executionAuthorized,false);
assert.equal(stale.productionWriteAuthorized,false);

console.log('Agent-6 S04 pending Approval Gate intake contract: PASS');
