import assert from 'node:assert/strict';
import { runAgent4ToA1Intake } from '../a4-a1-intake-runtime.js';

function window({ id, start, end, clicks, orders, spend, freshness = 'fresh' }) {
  return { window_id:id, start_at:start, end_at:end, clicks, attributed_orders:orders, spend, evidence_refs:[`evidence:${id}`], freshness };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A4-INTAKE-001',
    scope:{ scope_type:'product', scope_id:'PROD-4', product_id:'PROD-4', asin:'B0A4TEST01', marketplace:'US' },
    entity:{ entity_type:'target', entity_id:'TARGET-001' },
    baseline_window:window({ id:'A4-W1', start:'2026-09-03T00:00:00.000Z', end:'2026-09-03T01:00:00.000Z', clicks:20, orders:3, spend:18.5 }),
    current_window:window({ id:'A4-W2', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', clicks:24, orders:0, spend:23.1 }),
    sample_sufficient:true,
  };
}
const options={ generatedAt:'2026-09-03T03:00:01.000Z', receivedAt:'2026-09-03T03:00:02.000Z', mappedAt:'2026-09-03T03:00:03.000Z', currentTime:'2026-09-03T03:00:04.000Z', knownProductIds:['PROD-4'] };

const ready=runAgent4ToA1Intake(makeInput(), options);
assert.equal(ready.status,'ready_for_S02');
assert.equal(ready.nextAction,'continue_to_S02');
assert.equal(ready.readOnly,true);
assert.equal(ready.executionAuthorized,false);
assert.equal(ready.dispatchAuthorized,false);
assert.equal(ready.canonicalEvent.source_agent,'Agent-4');
assert.equal(ready.canonicalEvent.event_type,'advertising_conversion_breakdown');
assert.equal(ready.canonicalEvent.product_id,'PROD-4');
assert.equal(ready.canonicalEvent.metrics.entity_id,'TARGET-001');
assert.equal(ready.s01Result.normalized_event.event_id, ready.agent4Result.normalizedEvent.canonicalEvent.event_id);

const forged=runAgent4ToA1Intake({ ...makeInput(), dispatchAuthorized:true }, options);
assert.equal(forged.status,'blocked');
assert.ok(forged.reasons.includes('privilege_injection_dispatchAuthorized'));
assert.equal(forged.executionAuthorized,false);

const unknownProduct=runAgent4ToA1Intake(makeInput(), { ...options, knownProductIds:['OTHER'] });
assert.equal(unknownProduct.status,'blocked');
assert.notEqual(unknownProduct.nextAction,'continue_to_S02');

const insufficient=makeInput(); insufficient.sample_sufficient=false;
const notReady=runAgent4ToA1Intake(insufficient, options);
assert.equal(notReady.status,'needs_confirmation');
assert.equal(notReady.nextAction,'observe');
assert.equal(notReady.canonicalEvent,null);

console.log('Agent-4 to A1 S01 intake runtime contract: PASS');
