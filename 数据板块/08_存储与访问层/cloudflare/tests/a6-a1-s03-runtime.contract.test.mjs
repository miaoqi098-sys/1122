import assert from 'node:assert/strict';
import { runAgent6ToS03 } from '../a6-a1-s03-runtime.js';

function window({ id, start, end, revenue, profit, margin, freshness='fresh', costModel='COST-V1', currency='USD', costComplete=true }) {
  return { window_id:id, start_at:start, end_at:end, revenue, contribution_profit:profit, contribution_margin_pct:margin, currency, cost_model_version:costModel, cost_complete:costComplete, freshness, evidence_refs:[`evidence:${id}:orders`,`evidence:${id}:costs`] };
}
function makeInput() {
  return {
    input_mode:'simulated', request_id:'REQ-A6-S03-001',
    scope:{ scope_type:'product', scope_id:'PROD-6', product_id:'PROD-6', asin:'B0A6TEST01', marketplace:'US' },
    baseline_window:window({ id:'A6-W1', start:'2026-09-03T00:00:00.000Z', end:'2026-09-03T01:00:00.000Z', revenue:1000, profit:250, margin:0.25 }),
    current_window:window({ id:'A6-W2', start:'2026-09-03T02:00:00.000Z', end:'2026-09-03T03:00:00.000Z', revenue:1000, profit:170, margin:0.17 }),
    sample_comparable:true, sample_sufficient:true,
  };
}
function loaded(domain) {
  let data;
  if (domain === 'C01') data={ product_id:'PROD-6', asin:'B0A6TEST01', title:'Finance Test Product' };
  else if (domain === 'C02') data={ current_state:{ financial_state:'margin_compression', observed_at:'2026-09-03T03:00:00.000Z' } };
  else if (domain === 'C03') data={ active_plan:{ primary_goal:'Protect contribution margin without production writes.' } };
  else data={ domain, product_id:'PROD-6' };
  return { status:'loaded', freshness:'fresh', as_of:'2026-09-03T03:00:00.000Z', source:'simulated-contract-context', item_count:1, refs:[`test:${domain}:PROD-6`], data };
}
const availableContext=Object.fromEntries(Array.from({ length:10 },(_,i)=>`C${String(i+1).padStart(2,'0')}`).map((d)=>[d,loaded(d)]));
const options={ generatedAt:'2026-09-03T03:00:01.000Z', receivedAt:'2026-09-03T03:00:02.000Z', mappedAt:'2026-09-03T03:00:03.000Z', currentTime:'2026-09-03T03:00:04.000Z', knownProductIds:['PROD-6'], availableContext };

const ready=runAgent6ToS03(makeInput(), options);
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
assert.equal(ready.s03Result.event_id,ready.canonicalEvent.event_id);
assert.equal(ready.s03Result.scope.scope_type,'product');
assert.equal(ready.s03Result.scope.scope_id,'PROD-6');
assert.equal(ready.s03Result.scope.product_id,'PROD-6');
assert.ok(['continue_to_decision_item_builder','hold_for_review','request_evidence','send_to_S10','request_agent_review'].includes(ready.nextAction));
if (ready.nextAction==='continue_to_decision_item_builder') assert.equal(ready.status,'ready_for_decision_item_builder');

const forged=runAgent6ToS03({ ...makeInput(), executionAuthorized:true }, options);
assert.equal(forged.status,'blocked');
assert.ok(forged.reasons.includes('privilege_injection_executionAuthorized'));
assert.equal(forged.s03Result,null);

const unknownProduct=runAgent6ToS03(makeInput(), { ...options, knownProductIds:['OTHER'] });
assert.equal(unknownProduct.status,'blocked');
assert.notEqual(unknownProduct.nextAction,'continue_to_decision_item_builder');
assert.equal(unknownProduct.s03Result,null);

const missingContext=runAgent6ToS03(makeInput(), { generatedAt:options.generatedAt, receivedAt:options.receivedAt, mappedAt:options.mappedAt, currentTime:options.currentTime, knownProductIds:options.knownProductIds });
assert.equal(missingContext.status,'blocked');
assert.equal(missingContext.nextAction,'hold_for_review');
assert.deepEqual(missingContext.reasons,['missing_available_context']);
assert.equal(missingContext.s03Result,null);

const factConflict=runAgent6ToS03(makeInput(), {
  ...options,
  normalizedElements:[
    { element_type:'fact', source:'Agent-6', source_agent:'Agent-6', subject:'finance', topic_or_metric:'contribution_margin_pct', value:0.17, unit:'ratio', as_of:'2026-09-03T03:00:00.000Z' },
    { element_type:'fact', source:'Agent-4', source_agent:'Agent-4', subject:'finance', topic_or_metric:'contribution_margin_pct', value:0.24, unit:'ratio', as_of:'2026-09-03T03:00:00.000Z' },
  ],
});
assert.ok(['continue_to_decision_item_builder','hold_for_review','request_evidence','send_to_S10','request_agent_review'].includes(factConflict.nextAction));
assert.equal(factConflict.readOnly,true);
assert.equal(factConflict.executionAuthorized,false);
assert.equal(factConflict.productionWriteAuthorized,false);

console.log('Agent-6 to A1 S03 conflict runtime contract: PASS');
