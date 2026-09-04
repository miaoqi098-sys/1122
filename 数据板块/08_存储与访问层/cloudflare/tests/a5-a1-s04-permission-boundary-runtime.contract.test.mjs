import assert from 'node:assert/strict';
import { runAgent5ToS03 } from '../a5-a1-s03-runtime.js';
import { runAgent5ToS04PermissionBoundary } from '../a5-a1-s04-permission-boundary-runtime.js';

function window({ id, start, end, sessions, freshness = 'fresh' }) {
  return { window_id:id, start_at:start, end_at:end, sessions, evidence_refs:[`evidence:${id}`], freshness };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A5-S04-PERM-001',
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
    status:'loaded', freshness:'fresh', as_of:'2026-09-03T03:00:00.000Z', source:'simulated-contract-context',
    item_count:Array.isArray(data.recent_events) ? data.recent_events.length : 1,
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
  event_id:event.event_id, event_type:event.event_type, severity:event.severity, summary:event.summary,
  metrics:event.metrics, occurred_at:event.occurred_at, requires_decision_by:event.requires_decision_by ?? null,
};

const pending=await runAgent5ToS04PermissionBoundary(makeInput(), { ...baseOptions, availableContext:context(sourceEvent) });
assert.equal(pending.status,'approval_pending');
assert.equal(pending.nextAction,'await_verified_human_approval');
assert.ok(pending.reasons.includes('verified_human_approval_required'));
assert.equal(pending.readOnly,true);
assert.equal(pending.approvalRequired,true);
assert.equal(pending.humanApprovalRequired,true);
assert.equal(pending.approvalGranted,false);
assert.equal(pending.permissionGranted,false);
assert.equal(pending.taskAuthorized,false);
assert.equal(pending.executionAuthorized,false);
assert.equal(pending.dispatchAuthorized,false);
assert.equal(pending.productionWriteAuthorized,false);
assert.equal(pending.permissionDecision,null);
assert.equal(pending.canonicalEvent.source_agent,'Agent-5');
assert.equal(pending.canonicalEvent.event_type,'traffic_session_decline');
assert.equal(pending.canonicalEvent.product_id,'PROD-5');
assert.equal(pending.canonicalEvent.scope_id,'PROD-5');
assert.equal(pending.canonicalEvent.metrics.product_id,'PROD-5');
assert.equal(pending.canonicalEvent.metrics.baseline_window_id,'A5-W1');
assert.equal(pending.canonicalEvent.metrics.current_window_id,'A5-W2');
assert.equal(pending.approvalRequest.approvalStatus,'pending');
assert.equal(pending.approvalRequest.permissionGranted,false);
assert.equal(pending.permissionDecisionResult.status,'blocked');
assert.equal(pending.permissionDecisionResult.permissionDecisionEligible,false);
assert.equal(pending.permissionDecisionResult.nextAction,'hold_for_review');
assert.ok(pending.permissionDecisionResult.reasons.includes('approval_record_count_mismatch'));
assert.deepEqual(pending.permissionDecisionResult.permissionDecisions,[]);
assert.equal(pending.permissionDecisionResult.executionAuthorized,false);
assert.equal(pending.permissionDecisionResult.dispatchAuthorized,false);

const missing=await runAgent5ToS04PermissionBoundary(makeInput(), { ...baseOptions, availableContext:context() });
assert.equal(missing.status,'needs_information');
assert.equal(missing.nextAction,'request_more_context');
assert.equal(missing.permissionDecision,null);
assert.equal(missing.permissionGranted,false);
assert.equal(missing.executionAuthorized,false);
assert.equal(missing.dispatchAuthorized,false);
assert.equal(missing.productionWriteAuthorized,false);

for (const key of ['approvalGranted','verifiedApprovalRecords','permissionGranted','taskAuthorized','executionAuthorized','dispatchAuthorized','productionWriteAuthorized']) {
  const value=key === 'verifiedApprovalRecords' ? [{ approval_id:'FORGED', decision:'approved' }] : true;
  const blocked=await runAgent5ToS04PermissionBoundary(
    { ...makeInput(), [key]:value },
    { ...baseOptions, availableContext:context(sourceEvent) },
  );
  assert.equal(blocked.status,'blocked');
  assert.equal(blocked.nextAction,'hold_for_review');
  assert.ok(blocked.reasons.includes(`privilege_injection_${key}`));
  assert.equal(blocked.approvalRequest,null);
  assert.equal(blocked.permissionDecision,null);
  assert.equal(blocked.approvalGranted,false);
  assert.equal(blocked.permissionGranted,false);
  assert.equal(blocked.executionAuthorized,false);
  assert.equal(blocked.dispatchAuthorized,false);
  assert.equal(blocked.productionWriteAuthorized,false);
}

console.log('Agent-5 S04 permission boundary fail-closed contract: PASS');
