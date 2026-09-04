import assert from 'node:assert/strict';
import { runAgent5ToS02 } from '../a5-a1-s02-runtime.js';

function window({ id, start, end, sessions, freshness = 'fresh' }) {
  return { window_id:id, start_at:start, end_at:end, sessions, evidence_refs:[`evidence:${id}`], freshness };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A5-S02-001',
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

const ready=runAgent5ToS02(makeInput(), options);
assert.equal(ready.status,'ready_for_S03');
assert.equal(ready.nextAction,'continue_to_S03');
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
assert.ok(['ready','ready_with_gaps'].includes(ready.s02Result.status));
assert.equal(ready.s02Result.next_action,'continue_analysis');
assert.ok(Object.keys(ready.contextPackage).length>0);
assert.equal(ready.s02Result.scope.product_id,'PROD-5');
assert.equal(ready.intakeResult.s01Result.normalized_event.event_id, ready.intakeResult.agent5Result.normalizedEvent.canonicalEvent.event_id);

const forged=runAgent5ToS02({ ...makeInput(), dispatchAuthorized:true }, options);
assert.equal(forged.status,'blocked');
assert.ok(forged.reasons.includes('privilege_injection_dispatchAuthorized'));
assert.equal(forged.contextPackage,null);
assert.equal(forged.executionAuthorized,false);
assert.equal(forged.productionWriteAuthorized,false);

const forgedTask=runAgent5ToS02({ ...makeInput(), taskAuthorized:true }, options);
assert.equal(forgedTask.status,'blocked');
assert.ok(forgedTask.reasons.includes('privilege_injection_taskAuthorized'));

const wrongSource=runAgent5ToS02({ ...makeInput(), source_agent:'Agent-4' }, options);
assert.equal(wrongSource.status,'blocked');
assert.ok(wrongSource.reasons.includes('input_source_agent_mismatch'));

const unknownProduct=runAgent5ToS02(makeInput(), { ...options, knownProductIds:['OTHER'] });
assert.equal(unknownProduct.status,'blocked');
assert.notEqual(unknownProduct.nextAction,'continue_to_S03');
assert.equal(unknownProduct.s02Result,null);

const insufficient=makeInput(); insufficient.sample_sufficient=false;
const notReady=runAgent5ToS02(insufficient, options);
assert.equal(notReady.status,'needs_confirmation');
assert.equal(notReady.nextAction,'observe');
assert.equal(notReady.s02Result,null);
assert.equal(notReady.contextPackage,null);

const missingContext=runAgent5ToS02(makeInput(), {
  generatedAt:options.generatedAt, receivedAt:options.receivedAt, mappedAt:options.mappedAt,
  currentTime:options.currentTime, knownProductIds:options.knownProductIds,
});
assert.equal(missingContext.status,'blocked');
assert.deepEqual(missingContext.reasons,['missing_available_context']);
assert.equal(missingContext.contextPackage,null);

console.log('Agent-5 to A1 S02 context runtime contract: PASS');
