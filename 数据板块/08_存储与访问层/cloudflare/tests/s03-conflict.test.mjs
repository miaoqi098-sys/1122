import assert from 'node:assert/strict';
import { runS03, S03_RUNTIME_VERSION } from '../../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S03_冲突检测/执行程序/runtime.js';

const base = {
  event_id: 'EVT-S03-TEST',
  scope: { scope_type: 'product', scope_id: 'P1', product_id: 'P1' },
  context_package: { C02_business_state: { current_state: { price: 29.99, observed_at: '2026-09-01T00:00:00Z' } } },
  current_time: '2026-09-01T12:00:00Z',
};

function run(elements, context = base.context_package) {
  return runS03({ ...base, context_package: context, normalized_elements: elements });
}

// T07: no conflict must route to DecisionItemBuilder, never directly to S04.
{
  const d = run([
    { element_id: 'E1', element_type: 'fact', source: 'Amazon', subject: 'price', topic_or_metric: 'price', value: 29.99, unit: 'USD' },
  ]);
  assert.equal(d.runtime_version, S03_RUNTIME_VERSION);
  assert.equal(d.status, 'clear');
  assert.equal(d.next_action, 'continue_to_decision_item_builder');
  assert.equal(d.conflicts.length, 0);
}

// T02/T08: conflicting inventory facts are not averaged and require decisive evidence.
{
  const d = run([
    { element_id: 'E1', element_type: 'fact', source: 'Amazon FBA', source_agent: 'Agent-7', subject: 'FBA库存', topic_or_metric: 'fulfillable_quantity', value: 200, unit: 'units', time_window: 'current' },
    { element_id: 'E2', element_type: 'fact', source: 'ERP', subject: 'FBA库存', topic_or_metric: 'fulfillable_quantity', value: 20, unit: 'units', time_window: 'current' },
  ]);
  assert.ok(['needs_evidence', 'blocked'].includes(d.status));
  assert.equal(d.conflicts[0].type, 'fact');
  assert.equal(d.conflicts[0].decision_impact, 'blocks_decision');
  assert.match(d.conflicts[0].disputed_points.join(' '), /200/);
  assert.match(d.conflicts[0].disputed_points.join(' '), /20/);
  assert.equal(d.next_action, 'request_evidence');
}

// T14: incompatible units are treated as comparability/evidence issue, not numeric value judgement.
{
  const d = run([
    { element_id: 'E1', element_type: 'fact', source: 'A', subject: '库存', topic_or_metric: 'inventory', value: 10, unit: 'boxes', time_window: 'current' },
    { element_id: 'E2', element_type: 'fact', source: 'B', subject: '库存', topic_or_metric: 'inventory', value: 100, unit: 'units', time_window: 'current' },
  ]);
  assert.equal(d.conflicts[0].type, 'fact');
  assert.equal(d.conflicts[0].decision_impact, 'confidence_only');
  assert.match(d.conflicts[0].disputed_points.join(' '), /单位不可直接比较/);
}

// T04: reverse action during active observation window routes to S10; S03 does not override.
{
  const d = run([
    { element_id: 'E1', element_type: 'task', source: 'TaskCenter', subject: '广告预算', action_direction: 'increase_spend', status: 'OBSERVATION_WINDOW' },
    { element_id: 'E2', element_type: 'recommendation', source: 'Agent-4', source_agent: 'Agent-4', subject: '广告预算', action_direction: 'decrease' },
  ]);
  assert.equal(d.conflicts[0].type, 'strategy');
  assert.equal(d.next_action, 'send_to_S10');
  assert.notEqual(d.conflicts[0].type, 'agent');
}

// T05: frozen Listing plus scale recommendation is a critical hard-constraint conflict.
{
  const d = run([
    { element_id: 'E1', element_type: 'constraint', source: 'Amazon', subject: 'Listing状态', value: 'Listing frozen / 不可售' },
    { element_id: 'E2', element_type: 'recommendation', source: 'Agent-4', source_agent: 'Agent-4', subject: '广告预算', action_direction: 'increase_spend' },
  ]);
  assert.equal(d.status, 'blocked');
  assert.equal(d.conflicts[0].type, 'constraint');
  assert.equal(d.conflicts[0].severity, 'critical');
  assert.equal(d.conflicts[0].decision_impact, 'blocks_decision');
  assert.equal(d.next_action, 'hold_for_review');
}

// T01/T11: growth vs inventory/profit is grouped by root cause, Agents remain participants only.
{
  const context = {
    C03_current_goals: { primary: '保持可持续增长', constraints: ['避免断货', '不得突破利润底线'] },
    C04_core_metrics: { inventory_days_of_cover: 7, profit_pressure: 'high' },
  };
  const d = run([
    { element_id: 'E1', element_type: 'recommendation', source: 'Agent-4', source_agent: 'Agent-4', subject: '广告预算', goal: '扩大有效流量', action_direction: 'increase_spend' },
    { element_id: 'E2', element_type: 'fact', source: 'Agent-7', source_agent: 'Agent-7', subject: '库存', topic_or_metric: 'days_of_cover', value: 7, unit: 'days' },
    { element_id: 'E3', element_type: 'analysis', source: 'Agent-6', source_agent: 'Agent-6', subject: '利润', topic_or_metric: 'profit_pressure', value: 'high' },
  ], context);
  const growth = d.conflicts.find((c) => c.root_conflict === '增长目标 vs 当前资源承受能力');
  assert.ok(growth);
  assert.equal(growth.type, 'goal');
  assert.equal(growth.decision_impact, 'changes_ranking');
  assert.equal(d.next_action, 'continue_to_decision_item_builder');
  assert.ok(d.conflict_groups.some((g) => g.root_conflict === '增长目标 vs 当前资源承受能力'));
  assert.ok(growth.involved_agents.includes('Agent-4'));
}

// T10: approved budget test tension is retained but not blocked.
{
  const context = { C03_current_goals: { primary: '新品测试', note: '已批准测试预算内，保持观察窗口' } };
  const d = run([
    { element_id: 'E1', element_type: 'recommendation', source: 'Agent-4', subject: '广告预算', action_direction: 'increase_spend' },
    { element_id: 'E2', element_type: 'analysis', source: 'Agent-6', subject: '利润', topic_or_metric: 'profit_pressure', value: 'high' },
  ], context);
  const c = d.conflicts.find((x) => x.root_conflict === '增长目标 vs 当前资源承受能力');
  assert.ok(c);
  assert.equal(c.decision_impact, 'confidence_only');
  assert.notEqual(d.status, 'blocked');
}

// T06: same subject with competing interpretations requests minimal evidence.
{
  const d = run([
    { element_id: 'E1', element_type: 'analysis', source: 'Agent-4', source_agent: 'Agent-4', subject: 'CVR下降原因', topic_or_metric: 'conversion_cause', value: 'price' },
    { element_id: 'E2', element_type: 'hypothesis', source: 'Agent-2', source_agent: 'Agent-2', subject: 'CVR下降原因', topic_or_metric: 'conversion_cause', value: 'content' },
  ]);
  assert.equal(d.status, 'needs_evidence');
  assert.equal(d.conflicts[0].type, 'interpretation');
  assert.equal(d.next_action, 'request_evidence');
}

console.log(JSON.stringify({
  success: true,
  runtimeVersion: S03_RUNTIME_VERSION,
  contract: 'ContextPackage -> S03 -> Conflict/ConflictGroup -> DecisionItemBuilder',
}, null, 2));
