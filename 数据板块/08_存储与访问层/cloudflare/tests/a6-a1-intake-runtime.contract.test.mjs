import assert from 'node:assert/strict';
import { runAgent6ToA1Intake } from '../a6-a1-intake-runtime.js';

function window({ id, start, end, revenue, profit, margin, freshness='fresh', costModel='COST-V1', currency='USD', costComplete=true }) {
  return { window_id:id, start_at:start, end_at:end, revenue, contribution_profit:profit, contribution_margin_pct:margin, currency, cost_model_version:costModel, cost_complete:costComplete, freshness, evidence_refs:[`evidence:${id}:orders`,`evidence:${id}:costs`] };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A6-S01-001',
    scope:{ scope_type:'product', scope_id:'PROD-6', product_id:'PROD-6', asin:'B0A6TEST01', marketplace:'US' },
    baseline_window:window({ id:'A6-W1', start:'2026-09-03T00:00:00.000Z', end:'2026-09-03T01:00:00.000Z', revenue:1000, profit:250, margin:0.25 }),
    current_window:window({ id:'A6-W2', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', revenue:1000, profit:170, margin:0.17 }),
    sample_comparable:true, sample_sufficient:true,
  };
}
const options={ generatedAt:'2026-09-03T03:00:01.000Z', receivedAt:'2026-09-03T03:00:02.000Z', mappedAt:'2026-09-03T03:00:03.000Z', currentTime:'2026-09-03T03:00:04.000Z', knownProductIds:['PROD-6'] };

const ready=runAgent6ToA1Intake(makeInput(), options);
assert.equal(ready.status,'ready_for_S02');
assert.equal(ready.nextAction,'continue_to_S02');
assert.equal(ready.canonicalEvent.source_agent,'Agent-6');
assert.equal(ready.canonicalEvent.event_type,'MARGIN_COMPRESSION');
assert.equal(ready.canonicalEvent.product_id,'PROD-6');
assert.equal(ready.canonicalEvent.metrics.baseline_window_id,'A6-W1');
assert.equal(ready.canonicalEvent.metrics.current_window_id,'A6-W2');
assert.equal(ready.canonicalEvent.metrics.cost_model_version,'COST-V1');
assert.equal(ready.canonicalEvent.metrics.currency,'USD');
assert.equal(ready.readOnly,true);
assert.equal(ready.approvalGranted,false);
assert.equal(ready.permissionGranted,false);
assert.equal(ready.taskAuthorized,false);
assert.equal(ready.executionAuthorized,false);
assert.equal(ready.dispatchAuthorized,false);
assert.equal(ready.productionWriteAuthorized,false);

const forged=runAgent6ToA1Intake({ ...makeInput(), approvalGranted:true }, options);
assert.equal(forged.status,'blocked');
assert.ok(forged.reasons.includes('privilege_injection_approvalGranted'));
assert.equal(forged.canonicalEvent,null);
assert.equal(forged.executionAuthorized,false);

const unknown=runAgent6ToA1Intake(makeInput(), { ...options, knownProductIds:['OTHER'] });
assert.equal(unknown.status,'blocked');
assert.notEqual(unknown.nextAction,'continue_to_S02');
assert.equal(unknown.canonicalEvent,null);

const insufficient=makeInput(); insufficient.sample_sufficient=false;
const notReady=runAgent6ToA1Intake(insufficient, options);
assert.equal(notReady.status,'needs_confirmation');
assert.equal(notReady.nextAction,'observe');
assert.equal(notReady.canonicalEvent,null);

console.log('Agent-6 R16 to A1 S01 intake runtime contract: PASS');
