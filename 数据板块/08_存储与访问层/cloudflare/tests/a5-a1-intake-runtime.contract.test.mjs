import assert from 'node:assert/strict';
import { runAgent5ToA1Intake } from '../a5-a1-intake-runtime.js';

function window({ id, start, end, sessions, freshness = 'fresh' }) {
  return { window_id:id, start_at:start, end_at:end, sessions, evidence_refs:[`evidence:${id}`], freshness };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A5-INTAKE-001',
    scope:{ scope_type:'product', scope_id:'PROD-5', product_id:'PROD-5', asin:'B0A5TEST01', marketplace:'US' },
    baseline_window:window({ id:'A5-W1', start:'2026-09-03T00:00:00.000Z', end:'2026-09-03T01:00:00.000Z', sessions:100 }),
    current_window:window({ id:'A5-W2', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', sessions:70 }),
    sample_comparable:true,
    sample_sufficient:true,
  };
}
const options={ generatedAt:'2026-09-03T03:00:01.000Z', receivedAt:'2026-09-03T03:00:02.000Z', mappedAt:'2026-09-03T03:00:03.000Z', currentTime:'2026-09-03T03:00:04.000Z', knownProductIds:['PROD-5'] };

const ready=runAgent5ToA1Intake(makeInput(), options);
assert.equal(ready.status,'ready_for_S02');
assert.equal(ready.nextAction,'continue_to_S02');
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
assert.equal(ready.s01Result.normalized_event.event_id, ready.agent5Result.normalizedEvent.canonicalEvent.event_id);

const forged=runAgent5ToA1Intake({ ...makeInput(), dispatchAuthorized:true }, options);
assert.equal(forged.status,'blocked');
assert.ok(forged.reasons.includes('privilege_injection_dispatchAuthorized'));
assert.equal(forged.executionAuthorized,false);
assert.equal(forged.productionWriteAuthorized,false);

const forgedTask=runAgent5ToA1Intake({ ...makeInput(), taskAuthorized:true }, options);
assert.equal(forgedTask.status,'blocked');
assert.ok(forgedTask.reasons.includes('privilege_injection_taskAuthorized'));

const unknownProduct=runAgent5ToA1Intake(makeInput(), { ...options, knownProductIds:['OTHER'] });
assert.equal(unknownProduct.status,'blocked');
assert.notEqual(unknownProduct.nextAction,'continue_to_S02');

const insufficient=makeInput(); insufficient.sample_sufficient=false;
const notReady=runAgent5ToA1Intake(insufficient, options);
assert.equal(notReady.status,'needs_confirmation');
assert.equal(notReady.nextAction,'observe');
assert.equal(notReady.canonicalEvent,null);

console.log('Agent-5 to A1 S01 intake runtime contract: PASS');
