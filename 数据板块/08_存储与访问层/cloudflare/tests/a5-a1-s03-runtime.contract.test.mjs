import assert from 'node:assert/strict';
import { runAgent5ToS03 } from '../a5-a1-s03-runtime.js';

function window({ id, start, end, sessions, freshness = 'fresh' }) {
  return { window_id:id, start_at:start, end_at:end, sessions, evidence_refs:[`evidence:${id}`], freshness };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A5-S03-001',
    scope:{ scope_type:'product', scope_id:'PROD-5', product_id:'PROD-5', asin:'B0A5TEST01', marketplace:'US' },
    baseline_window:window({ id:'A5-W1', start:'2026-09-03T00:00:00.000Z', end:'2026-09-03T01:00:00.000Z', sessions:100 }),
    current_window:window({ id:'A5-W2', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', sessions:70 }),
    sample_comparable:true,
    sample_sufficient:true,
  };
}
function loaded(domain) {
  return {
    status:'loaded', freshness:'fresh', as_of:'2026-09-03T03:00:00.000Z',
    source:'simulated-contract-context', item_count:1,
    refs:[`test:${domain}:PROD-5`], data:{ domain, product_id:'PROD-5' },
  };
}
const availableContext=Object.fromEntries(
  Array.from({ length:10 },(_,i)=>`C${String(i+1).padStart(2,'0')}`).map((d)=>[d,loaded(d)]),
);
const options={ generatedAt:'2026-09-03T03:00:01.000Z', receivedAt:'2026-09-03T03:00:02.000Z', mappedAt:'2026-09-03T03:00:03.000Z', currentTime:'2026-09-03T03:00:04.000Z', knownProductIds:['PROD-5'], availableContext };

const ready=runAgent5ToS03(makeInput(), options);
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
assert.equal(ready.s03Result.event_id,ready.canonicalEvent.event_id);
assert.equal(ready.s03Result.scope.scope_type,'product');
assert.equal(ready.s03Result.scope.scope_id,'PROD-5');
assert.equal(ready.s03Result.scope.product_id,'PROD-5');
assert.ok(['continue_to_decision_item_builder','hold_for_review','request_evidence','send_to_S10','request_agent_review'].includes(ready.nextAction));
if (ready.nextAction==='continue_to_decision_item_builder') assert.equal(ready.status,'ready_for_decision_item_builder');

const forged=runAgent5ToS03({ ...makeInput(), executionAuthorized:true }, options);
assert.equal(forged.status,'blocked');
assert.equal(forged.nextAction,'hold_for_review');
assert.ok(forged.reasons.includes('privilege_injection_executionAuthorized'));
assert.equal(forged.s03Result,null);
assert.equal(forged.executionAuthorized,false);
assert.equal(forged.dispatchAuthorized,false);
assert.equal(forged.productionWriteAuthorized,false);

const forgedTask=runAgent5ToS03({ ...makeInput(), taskAuthorized:true }, options);
assert.equal(forgedTask.status,'blocked');
assert.ok(forgedTask.reasons.includes('privilege_injection_taskAuthorized'));
assert.equal(forgedTask.s03Result,null);

const wrongSource=runAgent5ToS03({ ...makeInput(), source_agent:'Agent-4' }, options);
assert.equal(wrongSource.status,'blocked');
assert.ok(wrongSource.reasons.includes('input_source_agent_mismatch'));
assert.equal(wrongSource.s03Result,null);

const unknownProduct=runAgent5ToS03(makeInput(), { ...options, knownProductIds:['OTHER'] });
assert.equal(unknownProduct.status,'blocked');
assert.notEqual(unknownProduct.nextAction,'continue_to_decision_item_builder');
assert.equal(unknownProduct.s03Result,null);

const insufficient=makeInput(); insufficient.sample_sufficient=false;
const notReady=runAgent5ToS03(insufficient, options);
assert.equal(notReady.status,'needs_confirmation');
assert.equal(notReady.nextAction,'observe');
assert.equal(notReady.s03Result,null);

const missingContext=runAgent5ToS03(makeInput(), {
  generatedAt:options.generatedAt, receivedAt:options.receivedAt, mappedAt:options.mappedAt,
  currentTime:options.currentTime, knownProductIds:options.knownProductIds,
});
assert.equal(missingContext.status,'blocked');
assert.equal(missingContext.nextAction,'hold_for_review');
assert.deepEqual(missingContext.reasons,['missing_available_context']);
assert.equal(missingContext.s03Result,null);

const factConflict=runAgent5ToS03(makeInput(), {
  ...options,
  normalizedElements:[
    { element_type:'fact', source:'Agent-5', source_agent:'Agent-5', subject:'traffic', topic_or_metric:'sessions', value:70, unit:'sessions', as_of:'2026-09-03T03:00:00.000Z' },
    { element_type:'fact', source:'Agent-6', source_agent:'Agent-6', subject:'traffic', topic_or_metric:'sessions', value:90, unit:'sessions', as_of:'2026-09-03T03:00:00.000Z' },
  ],
});
assert.ok(['continue_to_decision_item_builder','hold_for_review','request_evidence','send_to_S10','request_agent_review'].includes(factConflict.nextAction));
assert.equal(factConflict.readOnly,true);
assert.equal(factConflict.executionAuthorized,false);
assert.equal(factConflict.dispatchAuthorized,false);
assert.equal(factConflict.productionWriteAuthorized,false);

console.log('Agent-5 to A1 S03 conflict runtime contract: PASS');
