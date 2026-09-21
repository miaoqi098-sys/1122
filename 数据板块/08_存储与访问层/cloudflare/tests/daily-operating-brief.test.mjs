import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyOperatingBrief } from '../daily-operating-brief.js';
import { buildUiBootstrap } from '../ui-bootstrap.js';

const product = {
  product_id: 'product-1',
  marketplace: 'US',
  asin: 'B0TEST1122',
  business_date: '2026-09-20',
  state_observed_at: '2026-09-21T01:00:00Z',
  sales: 120,
  sessions: 800,
  conversion_rate: 0.08,
  ad_spend: 30,
  tacos: 0.25,
  coverage_days: 28,
  contribution_profit: 12,
};

const activePlan = {
  plan_id: 'PLAN-1',
  stage: 'GROWTH',
  primary_goal: '验证可复制流量',
  strategy: '保护核心词并验证增长单元',
  constraints_json: JSON.stringify({ primary_constraint: 'KEYWORD_RANK_CONSTRAINT' }),
  updated_at: '2026-09-20T10:00:00Z',
};

const metrics = [
  { metric_key: 'amazon.sessions', metric_value: 800, prior_value: 1000, baseline_7d: 1050, delta_pct: -0.238, signal: 'DROP', computed_at: '2026-09-21T01:00:00Z' },
  { metric_key: 'amazon.conversion_rate', metric_value: 0.08, prior_value: 0.11, baseline_7d: 0.12, delta_pct: -0.333, signal: 'DROP_HIGH', computed_at: '2026-09-21T01:00:00Z' },
];

function event(event_id, event_type, severity = 'HIGH') {
  return {
    event_id,
    event_type,
    severity,
    evidence_json: JSON.stringify({ metricKey: event_type, currentValue: 1, baseline7d: 2, deltaPct: -0.5 }),
  };
}

test('daily brief joins same-day facts into a diagnosed but non-executing traffic and conversion work item', () => {
  const brief = buildDailyOperatingBrief({
    product,
    plan: activePlan,
    metrics,
    events: [event('EV-traffic', 'AMAZON_SESSIONS_DROP'), event('EV-cvr', 'CONVERSION_DROP')],
  });

  assert.equal(brief.data_status.status, 'DATA_READY');
  assert.equal(brief.strategy_context.current_stage, 'GROWTH');
  assert.equal(brief.strategy_context.primary_goal, '验证可复制流量');
  assert.equal(brief.overall_status, 'YELLOW');
  assert.deepEqual(brief.signals.map((item) => item.signal_type), ['TRAFFIC_DROP', 'CVR_DROP']);
  assert.equal(brief.root_cause_assessments[0].primary_root_cause, 'TRAFFIC_AND_CONVERSION_CONSTRAINT');
  assert.match(brief.actions[0].action, /联合诊断任务/);
  assert.equal(brief.actions[0].approval_level, 'L1');
  assert.equal(brief.audit.execution_authorized, false);
});

test('inventory coverage under seven days is a P0 signal and produces an approval-gated protection task', () => {
  const brief = buildDailyOperatingBrief({
    product: { ...product, coverage_days: 6 },
    plan: activePlan,
    metrics,
    events: [event('EV-stock', 'INVENTORY_COVERAGE_LOW')],
  });

  assert.equal(brief.overall_status, 'RED');
  assert.equal(brief.signals[0].severity, 'P0');
  assert.equal(brief.root_cause_assessments[0].primary_root_cause, 'INVENTORY_CONSTRAINT');
  assert.match(brief.actions[0].action, /补货与库存保护评估任务/);
  assert.equal(brief.actions[0].decision_item_required, true);
});

test('brief does not invent a strategy or operating action when the daily facts or plan are missing', () => {
  const noDataBrief = buildDailyOperatingBrief({ product, metrics: [] });
  assert.equal(noDataBrief.data_status.status, 'DATA_INCOMPLETE');
  assert.equal(noDataBrief.strategy_context.current_stage, 'NEEDS_DATA');
  assert.match(noDataBrief.actions[0].action, /补齐当日经营数据/);

  const noPlanBrief = buildDailyOperatingBrief({ product, metrics });
  assert.equal(noPlanBrief.data_status.status, 'DATA_READY');
  assert.equal(noPlanBrief.strategy_context.primary_goal, 'NEEDS_DATA');
  assert.match(noPlanBrief.actions[0].action, /补充产品推广计划/);
});

test('UI bootstrap exposes the generated daily brief as a live D1 read model', async () => {
  const db = {
    prepare(sql) {
      const all = async () => {
        if (sql.includes('FROM products p')) return { results: [product] };
        if (sql.includes("source_key LIKE 'a1_%'")) return { results: [] };
        if (sql.includes('FROM tasks\n')) return { results: [] };
        if (sql.includes('FROM data_source_state')) return { results: [] };
        if (sql.includes('FROM product_operating_plans')) return { results: [activePlan] };
        if (sql.includes('FROM product_daily_metrics')) return { results: metrics.map((metric) => ({ ...metric, product_id: product.product_id, business_date: product.business_date })) };
        if (sql.includes('FROM events')) return { results: [{ ...event('EV-stock', 'INVENTORY_COVERAGE_LOW'), product_id: product.product_id, occurred_at: `${product.business_date}T23:59:59Z` }] };
        if (sql.includes('FROM validation_results')) return { results: [] };
        throw new Error(`Unexpected query: ${sql}`);
      };
      return {
        bind() {
          return { all };
        },
        all,
      };
    },
  };

  const payload = await buildUiBootstrap({ CORE_DB: db }, { marketplace: 'US' });
  assert.equal(payload.source_status.daily_operating_briefs, 'LIVE_D1_READ', JSON.stringify(payload.source_status));
  assert.equal(payload.daily_operating_briefs.length, 1);
  assert.equal(payload.daily_operating_briefs[0].brief_id, 'DOB:product-1:2026-09-20');
  assert.equal(payload.daily_operating_briefs[0].signals[0].signal_type, 'STOCKOUT_RISK');
});
