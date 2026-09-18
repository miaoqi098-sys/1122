import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(testDirectory, '..', '..');
const source = await readFile(new URL('../operations-planning-pages.js', import.meta.url), 'utf8');

function loadRenderers() {
  const window = { __1122_PAGE_RENDERERS__: {} };
  const context = vm.createContext({ window, Intl });
  vm.runInContext(source, context, { filename: 'operations-planning-pages.js' });
  return window.__1122_PAGE_RENDERERS__;
}

async function render(renderer, data, query = '') {
  const view = { innerHTML: '' };
  const chrome = [];
  await renderer({
    data,
    query: new URLSearchParams(query),
    view,
    setChrome: (...values) => chrome.push(values),
    isCurrent: () => true,
  });
  return { html: view.innerHTML, chrome };
}

function liveData() {
  return {
    generated_at: '2026-09-18T10:00:00.000Z',
    products: [{
      product_id: 'product-1',
      asin: 'B0TEST1122',
      title: '<Safe Product>',
      marketplace: 'US',
      business_date: '2026-09-18',
      stage: 'GROWTH',
      primary_goal: '验证可复制流量',
      sales: 102.5,
      currency: 'USD',
      conversion_rate: 0.12,
      coverage_days: 31,
    }],
    tasks: [{
      task_id: 'TASK-1',
      product_id: 'product-1',
      task_type: 'REVIEW_PLAN',
      task_status: 'PENDING_APPROVAL',
      approval_status: 'PENDING',
    }],
    promotion_plans: [{
      plan_id: 'PLAN-1',
      asin: 'B0TEST1122',
      plan_status: 'ACTIVE',
      stage_assessment: { current_stage: 'GROWTH', confidence: 0.82, reason: '已形成可验证的成交样本。' },
      constraint_assessment: { primary_constraint: 'KEYWORD_RANK_CONSTRAINT', reason: '核心词自然位仍需证据支持。' },
      strategy_assessment: {
        primary_strategy: '保护核心词并验证增长单元',
        recommended_actions: [{ action: '观察', why: '保留最小样本。', evidence: ['D1:product_daily_state'], expected_result: '确认关键词趋势', observation_window: '7d', stop_condition: '样本不足', approval_level: 'L0' }],
        avoid_actions: [{ action: '大幅扩量', why: '避免失去归因。' }],
      },
    }],
    daily_operating_briefs: [{
      brief_id: 'BRIEF-1',
      asin_scope: ['B0TEST1122'],
      overall_status: 'YELLOW',
      today_focus: ['检查核心词样本'],
      strategy_context: {
        current_stage: 'GROWTH',
        primary_goal: '验证可复制流量',
        primary_constraint: 'KEYWORD_RANK_CONSTRAINT',
      },
      signals: [{ signal_id: 'SIG-1' }],
      root_cause_assessments: [{ signal_id: 'SIG-1', status: 'NEEDS_DATA' }],
      actions: [{ action_id: 'ACT-1', action: '观察核心词', why: '样本尚在积累。', evidence: ['D1:keyword_signal'], expected_result: '确认排名趋势', observation_window: '7d', stop_condition: '数据冲突', approval_level: 'L0' }],
      action_validation: [{ action_id: 'ACT-0', validation_status: 'NEUTRAL', next_step: '继续观察' }],
      stage_review: { transition_candidate: 'SCALE', strategy_refresh_required: false },
    }],
    __source: {
      source_status: {
        products: 'LIVE_D1_READ',
        tasks: 'LIVE_D1_READ',
        promotion_plans: 'LIVE_D1_READ',
        daily_operating_briefs: 'LIVE_D1_READ',
      },
    },
  };
}

test('planning pages render canonical plan and Daily Brief data without treating product facts as unescaped HTML', async () => {
  const renderers = loadRenderers();
  const data = liveData();
  const promotion = await render(renderers['/operations/products/promotion-plan'], data, 'product_id=product-1');
  const sop = await render(renderers['/operations/daily-sop'], data, 'product_id=product-1');

  assert.deepEqual(promotion.chrome[0], ['产品推广计划', '运营 / 产品 / 产品推广计划']);
  assert.match(promotion.html, /PLAN-1/);
  assert.match(promotion.html, /KEYWORD_RANK_CONSTRAINT/);
  assert.match(promotion.html, /保护核心词并验证增长单元/);
  assert.match(promotion.html, /已接入计划详情/);
  assert.match(promotion.html, /确认关键词趋势/);
  assert.match(promotion.html, /&lt;Safe Product&gt;/);
  assert.doesNotMatch(promotion.html, /<Safe Product>/);

  assert.deepEqual(sop.chrome[0], ['每日工作 SOP', '运营 / 每日工作 SOP']);
  assert.match(sop.html, /检查核心词样本/);
  assert.match(sop.html, /1 条 Signal/);
  assert.match(sop.html, /PENDING_APPROVAL/);
  assert.match(sop.html, /今日四轮工作节奏/);
  assert.match(sop.html, /已接入 Daily Brief 详情/);
  assert.match(sop.html, /观察核心词/);
  assert.match(sop.html, /继续观察/);
});

test('planning pages remain explicit about missing formal read models instead of inferring a plan or brief', async () => {
  const renderers = loadRenderers();
  const data = liveData();
  data.__source.source_status.promotion_plans = 'NOT_INGESTED';
  data.__source.source_status.daily_operating_briefs = 'NOT_INGESTED';
  const promotion = await render(renderers['/operations/products/promotion-plan'], data);
  const sop = await render(renderers['/operations/daily-sop'], data);

  assert.match(promotion.html, /计划数据待接入/);
  assert.match(promotion.html, /PLAN NOT INGESTED/);
  assert.doesNotMatch(promotion.html, /计划 PLAN-1/);
  assert.match(sop.html, /Daily Brief 待接入/);
  assert.match(sop.html, /不能从任务或单日指标推导 Signal/);
  assert.doesNotMatch(sop.html, /检查核心词样本/);
});

test('formal and runtime navigation register the SOP and promotion-plan pages with their UI contracts', async () => {
  const [formalText, runtimeRegistry, sopContract, planContract, index, home, livePages, systemPages] = await Promise.all([
    readFile(join(repositoryRoot, 'UI界面设计板块', 'NavigationRegistry.v2.json'), 'utf8'),
    readFile(join(repositoryRoot, 'web-console', 'registry.js'), 'utf8'),
    readFile(join(repositoryRoot, 'UI界面设计板块', '每日工作SOP', 'DailyOperatingBriefView.schema.json'), 'utf8'),
    readFile(join(repositoryRoot, 'UI界面设计板块', '产品推广计划', 'ProductPromotionPlanView.schema.json'), 'utf8'),
    readFile(join(repositoryRoot, 'web-console', 'index.html'), 'utf8'),
    readFile(join(repositoryRoot, 'web-console', 'home-live.js'), 'utf8'),
    readFile(join(repositoryRoot, 'web-console', 'live-pages.js'), 'utf8'),
    readFile(join(repositoryRoot, 'web-console', 'system-pages.js'), 'utf8'),
  ]);
  const formal = JSON.parse(formalText);
  const flatten = items => items.flatMap(item => [item, ...flatten(item.children || [])]);
  const operations = formal.primary_navigation.find(item => item.id === 'operations');
  const routes = new Map(flatten(operations.children).map(item => [item.id, item]));

  assert.equal(routes.get('daily-sop')?.route, '/operations/daily-sop');
  assert.equal(routes.get('product-promotion-plan')?.route, '/operations/products/promotion-plan');
  assert.equal(routes.get('daily-sop')?.view_contract, 'UI界面设计板块/每日工作SOP/DailyOperatingBriefView.schema.json');
  assert.equal(routes.get('product-promotion-plan')?.view_contract, 'UI界面设计板块/产品推广计划/ProductPromotionPlanView.schema.json');
  assert.match(runtimeRegistry, /id:'daily-sop'/);
  assert.match(runtimeRegistry, /route:'\/operations\/daily-sop'/);
  assert.match(runtimeRegistry, /id:'product-promotion-plan'/);
  assert.match(runtimeRegistry, /route:'\/operations\/products\/promotion-plan'/);
  assert.equal(JSON.parse(sopContract).title, 'DailyOperatingBriefView V1');
  assert.equal(JSON.parse(planContract).title, 'ProductPromotionPlanView V1');
  assert.ok(index.indexOf('./operations-planning-pages.js') < index.indexOf('./app.js'));
  assert.match(home, /\/operations\/daily-sop/);
  assert.match(home, /\/operations\/products\/promotion-plan/);
  assert.match(livePages, /\/operations\/products\/promotion-plan\?product_id=/);
  assert.match(systemPages, /DailyOperatingBriefView/);
  assert.match(systemPages, /ProductPromotionPlanView/);
});

test('planning page renderer is read-only and does not introduce a transport or write request', () => {
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\b(?:POST|PUT|PATCH|DELETE)\b/);
});
