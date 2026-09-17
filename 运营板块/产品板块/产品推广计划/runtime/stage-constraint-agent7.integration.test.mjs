import assert from 'node:assert/strict';
import stageConstraintEngine from './stage-constraint-engine-v1.js';
import { runAgent7LowCoverage } from '../../../../数据板块/08_存储与访问层/cloudflare/a7-inventory-supply-runtime.js';

const { evaluateConstraints } = stageConstraintEngine;

const agent7Result = runAgent7LowCoverage({
  input_mode: 'simulated',
  scope: {
    scope_type: 'product',
    scope_id: 'US:STAGE-CONSTRAINT-1',
    product_id: 'STAGE-CONSTRAINT-1',
    marketplace: 'US',
  },
  inventory_snapshot: {
    snapshot_id: 'INV-STAGE-CONSTRAINT-1',
    observed_at: '2026-09-17T00:00:00.000Z',
    available_units: 180,
    freshness: 'fresh',
  },
  demand_baseline: {
    baseline_id: 'DEMAND-STAGE-CONSTRAINT-1',
    daily_units: 10,
    freshness: 'fresh',
  },
  lead_time_days: 35,
  safety_stock_days: 0,
  evidence_refs: ['sim://inventory/stage-constraint-1', 'sim://demand/stage-constraint-1'],
});

assert.equal(agent7Result.inventorySupplyEvent.event_type, 'LOW_COVERAGE');
assert.equal(agent7Result.normalizedEvent.canonicalEvent.metrics.coverage_days, 18);
assert.equal(agent7Result.normalizedEvent.canonicalEvent.metrics.lead_time_days, 35);

const assessment = evaluateConstraints({
  data_sufficiency: 'SUFFICIENT',
  constraint_candidates: [],
  inventory_event: agent7Result,
});

assert.equal(assessment.primary_constraint, 'INVENTORY_CONSTRAINT');
assert.equal(assessment.effective_scale_posture, 'HOLD_SCALE');
assert.ok(assessment.strategy_guardrail.blocked_strategy_changes.includes('SCALE_UP'));
assert.notEqual(assessment.recommended_strategy, 'SCALE_UP');

console.log('stage-constraint-agent7.integration.test: PASS');
