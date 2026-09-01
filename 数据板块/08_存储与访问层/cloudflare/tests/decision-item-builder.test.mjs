import assert from 'node:assert/strict';
import {
  runDecisionItemBuilder,
  DECISION_ITEM_BUILDER_RUNTIME_VERSION,
} from '../../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/统一接口/执行程序/decision-item-builder.runtime.js';

const base = {
  scope: { scope_type: 'product', scope_id: 'P1', product_id: 'P1', asin: 'B000TEST01' },
  source_event_refs: ['EVT-TRAFFIC-1'],
  context_refs: ['d1:products:P1', 'd1:product_operating_plans:PLAN-1'],
  context_package: {
    C01_product_identity: { product_id: 'P1', asin: 'B000TEST01', title: 'Test Product' },
    C02_business_state: { current_state: { stage: 'growth', primary_goal: null } },
    C03_current_goals: {
      active_plan: { plan_id: 'PLAN-1', primary_goal: 'Restore qualified traffic while protecting conversion quality', stage: 'growth' },
      goals: [],
    },
    C05_events_and_promotions: {
      recent_events: [{
        event_id: 'EVT-TRAFFIC-1',
        event_type: 'AMAZON_SESSIONS_DROP',
        severity: 'HIGH',
        evidence: { currentValue: 75, baseline7d: 100, deltaPct: -0.25, historyPoints: 7 },
      }],
    },
  },
  conflicts: [],
  conflict_groups: [],
  s03_status: 'clear',
  s03_next_action: 'continue_to_decision_item_builder',
  current_time: '2026-09-01T15:50:00Z',
};

const ready = runDecisionItemBuilder(base);
assert.equal(ready.runtime_version, DECISION_ITEM_BUILDER_RUNTIME_VERSION);
assert.equal(ready.next_action, 'continue_to_S04');
assert.equal(ready.decision_items.length, 1);
const item = ready.decision_items[0];
assert.equal(item.decision_item_id, 'DI:EVT-TRAFFIC-1:01');
assert.equal(item.item_type, 'problem');
assert.equal(item.goal_layer, 'business_quality');
assert.equal(item.urgency, 'high');
assert.equal(item.objective, 'Restore qualified traffic while protecting conversion quality');
assert.equal(item.objective_source, 'C03.active_plan.primary_goal');
assert.equal(item.previous_priority, 'none');
assert.ok(item.source_event_refs.includes('EVT-TRAFFIC-1'));
assert.ok(!Object.hasOwn(item, 'business_priority'));

const missingObjective = structuredClone(base);
delete missingObjective.context_package.C03_current_goals;
missingObjective.context_package.C02_business_state.current_state.primary_goal = null;
const gap = runDecisionItemBuilder(missingObjective);
assert.equal(gap.next_action, 'request_more_context');
assert.deepEqual(gap.decision_items, []);
assert.match(gap.builder_notes.join(' '), /不自创目标/);

// S03 is the routing authority. Every non-forward S03 route must remain gated here
// so blocked/evidence/escalation/observation cases can never leak into S04.
const gatedRoutes = [
  ['blocked', 'hold_for_review'],
  ['needs_evidence', 'request_evidence'],
  ['conflicts_found', 'send_to_S10'],
  ['conflicts_found', 'request_agent_review'],
];
for (const [s03Status, s03NextAction] of gatedRoutes) {
  const gated = runDecisionItemBuilder({
    ...base,
    s03_status: s03Status,
    s03_next_action: s03NextAction,
  });
  assert.equal(gated.next_action, 'hold_for_review');
  assert.equal(gated.decision_items.length, 0);
  assert.match(gated.builder_notes.join(' '), new RegExp(s03NextAction));
}

// Fail closed when the S03 routing signal is missing or unknown.
for (const s03NextAction of [undefined, null, '', 'continue_to_S04', 'unknown_route']) {
  const input = { ...base, s03_next_action: s03NextAction };
  const gated = runDecisionItemBuilder(input);
  assert.equal(gated.next_action, 'hold_for_review');
  assert.equal(gated.decision_items.length, 0);
  assert.match(gated.builder_notes.join(' '), /S03 next_action=/);
}

const conflictInput = structuredClone(base);
conflictInput.s03_status = 'conflicts_found';
conflictInput.conflicts = [{
  conflict_id: 'CF-001', type: 'goal', severity: 'medium', decision_impact: 'changes_ranking',
  disputed_points: ['growth vs inventory'], resolution_evidence: ['d1:inventory_snapshots:1'],
}];
conflictInput.conflict_groups = [{ conflict_group_id: 'CFG-001' }];
const withConflict = runDecisionItemBuilder(conflictInput);
assert.equal(withConflict.next_action, 'continue_to_S04');
assert.ok(withConflict.decision_items[0].conflict_refs.includes('CF-001'));
assert.equal(withConflict.decision_items[0].dependency_count, 1);
assert.ok(withConflict.decision_items[0].evidence_refs.includes('d1:inventory_snapshots:1'));

console.log(JSON.stringify({
  success: true,
  runtimeVersion: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
  happyPath: ready.next_action,
  missingObjective: gap.next_action,
  gatedRoutes: gatedRoutes.map(([status, nextAction]) => ({ status, nextAction })),
  failClosedRoutes: ['missing', 'null', 'empty', 'continue_to_S04', 'unknown_route'],
  conflictRefs: withConflict.decision_items[0].conflict_refs,
}, null, 2));