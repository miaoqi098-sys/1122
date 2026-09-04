import assert from 'node:assert/strict';
import { runAgent6MarginCompression } from '../a6-financial-runtime.js';

function window({ id, start, end, revenue, profit, margin, freshness = 'fresh', costModel = 'COST-V1', currency = 'USD', costComplete = true }) {
  return {
    window_id: id,
    start_at: start,
    end_at: end,
    revenue,
    contribution_profit: profit,
    contribution_margin_pct: margin,
    currency,
    cost_model_version: costModel,
    cost_complete: costComplete,
    freshness,
    evidence_refs: [`evidence:${id}:orders`, `evidence:${id}:costs`],
  };
}

function makeInput() {
  return {
    input_mode: 'simulated',
    request_id: 'REQ-A6-MARGIN-001',
    scope: {
      scope_type: 'product',
      scope_id: 'PROD-6',
      product_id: 'PROD-6',
      asin: 'B0A6TEST01',
      marketplace: 'US',
    },
    baseline_window: window({
      id: 'A6-W1',
      start: '2026-09-03T00:00:00.000Z',
      end: '2026-09-03T01:00:00.000Z',
      revenue: 1000,
      profit: 250,
      margin: 0.25,
    }),
    current_window: window({
      id: 'A6-W2',
      start: '2026-09-03T02:00:00.000Z',
      end: '2026-09-03T03:00:00.000Z',
      revenue: 1000,
      profit: 170,
      margin: 0.17,
    }),
    sample_comparable: true,
    sample_sufficient: true,
  };
}

const options = {
  generatedAt: '2026-09-03T03:00:01.000Z',
  receivedAt: '2026-09-03T03:00:02.000Z',
  mappedAt: '2026-09-03T03:00:03.000Z',
};

const ready = runAgent6MarginCompression(makeInput(), options);
assert.equal(ready.status, 'event_and_response_ready');
assert.equal(ready.nextAction, 'stop_before_A1_intake');
assert.equal(ready.readOnly, true);
assert.equal(ready.approvalGranted, false);
assert.equal(ready.permissionGranted, false);
assert.equal(ready.taskAuthorized, false);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.productionWriteAuthorized, false);
assert.equal(ready.financialEvent.agent_id, 'Agent-6');
assert.equal(ready.financialEvent.event_type, 'MARGIN_COMPRESSION');
assert.equal(ready.financialEvent.financial_impact.metric, 'contribution_margin_pct');
assert.equal(ready.normalizedEvent.status, 'normalized');
assert.equal(ready.normalizedEvent.canonicalEvent.source_agent, 'Agent-6');
assert.equal(ready.normalizedEvent.canonicalEvent.event_type, 'MARGIN_COMPRESSION');
assert.equal(ready.normalizedEvent.canonicalEvent.product_id, 'PROD-6');
assert.equal(ready.normalizedEvent.canonicalEvent.metrics.baseline_window_id, 'A6-W1');
assert.equal(ready.normalizedEvent.canonicalEvent.metrics.current_window_id, 'A6-W2');
assert.equal(ready.normalizedEvent.canonicalEvent.metrics.margin_compression_pp, 8);
assert.equal(ready.normalizedResponse.status, 'normalized');
assert.equal(ready.normalizedResponse.canonicalResponse.source_agent, 'Agent-6');

const forged = runAgent6MarginCompression({ ...makeInput(), permissionGranted: true }, options);
assert.equal(forged.status, 'blocked');
assert.equal(forged.nextAction, 'hold_for_review');
assert.ok(forged.reasons.includes('privilege_injection_permissionGranted'));
assert.equal(forged.normalizedEvent, null);
assert.equal(forged.executionAuthorized, false);
assert.equal(forged.productionWriteAuthorized, false);

const mismatchedCost = makeInput();
mismatchedCost.current_window = window({
  id: 'A6-W2', start: '2026-09-03T02:00:00.000Z', end: '2026-09-03T03:00:00.000Z',
  revenue: 1000, profit: 170, margin: 0.17, costModel: 'COST-V2',
});
const costMismatch = runAgent6MarginCompression(mismatchedCost, options);
assert.equal(costMismatch.status, 'blocked');
assert.ok(costMismatch.reasons.includes('cost_model_version_mismatch'));
assert.equal(costMismatch.normalizedEvent, null);

const incompleteCost = makeInput();
incompleteCost.current_window = window({
  id: 'A6-W2', start: '2026-09-03T02:00:00.000Z', end: '2026-09-03T03:00:00.000Z',
  revenue: 1000, profit: 170, margin: 0.17, costComplete: false,
});
const incomplete = runAgent6MarginCompression(incompleteCost, options);
assert.equal(incomplete.status, 'blocked');
assert.ok(incomplete.reasons.includes('current_cost_basis_not_complete'));

const unreconciled = makeInput();
unreconciled.current_window = window({
  id: 'A6-W2', start: '2026-09-03T02:00:00.000Z', end: '2026-09-03T03:00:00.000Z',
  revenue: 1000, profit: 170, margin: 0.12,
});
const badMath = runAgent6MarginCompression(unreconciled, options);
assert.equal(badMath.status, 'blocked');
assert.ok(badMath.reasons.includes('current_margin_reconciliation_failed'));

const smallCompression = makeInput();
smallCompression.current_window = window({
  id: 'A6-W2', start: '2026-09-03T02:00:00.000Z', end: '2026-09-03T03:00:00.000Z',
  revenue: 1000, profit: 220, margin: 0.22,
});
const small = runAgent6MarginCompression(smallCompression, options);
assert.equal(small.status, 'needs_recheck');
assert.equal(small.nextAction, 'observe');
assert.equal(small.normalizedEvent, null);

const lossMaking = makeInput();
lossMaking.current_window = window({
  id: 'A6-W2', start: '2026-09-03T02:00:00.000Z', end: '2026-09-03T03:00:00.000Z',
  revenue: 1000, profit: -50, margin: -0.05,
});
const loss = runAgent6MarginCompression(lossMaking, options);
assert.equal(loss.status, 'needs_reclassification');
assert.equal(loss.nextAction, 'observe');
assert.ok(loss.reasons.includes('loss_making_signal_requires_separate_runtime'));
assert.equal(loss.normalizedEvent, null);

console.log('Agent-6 read-only margin compression to R16 contract: PASS');
