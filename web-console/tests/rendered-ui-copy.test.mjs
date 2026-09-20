import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const pageSources = await Promise.all([
  'ui-text.js',
  'registry.js',
  'data/system-catalog.js',
  'home-live.js',
  'live-pages.js',
  'operations-planning-pages.js',
  'boundary-pages.js',
  'system-pages.js',
  'connector-pages.js',
  'ads-page.js',
  'knowledge-page.js'
].map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));

function node() {
  return {
    innerHTML: '', textContent: '', value: '', disabled: false,
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, focus() {}, select() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML() {}
  };
}

function makeHarness() {
  const nodes = new Map();
  const document = {
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, node());
      return nodes.get(id);
    }
  };
  const health = id => ({
    connector_id: id,
    status: 'CONNECTED',
    checked_at: '2026-09-20T08:00:00.000Z',
    latency_ms: 8,
    capabilities: [],
    details: {
      marketplace_count: 1,
      product_count: 1,
      product_ready: true,
      profiles_count: 1,
      region: '中国区',
      tool_count: 1,
      queue_bound: true,
      research_login_configured: true,
      research_configured: true,
      research_max_asins: 10,
      marketplaces: [{ countryCode: '中国', marketplaceId: '站点一', participating: true }]
    },
    write: { session_gate_configured: true },
    error: null
  });
  const window = {
    __1122_PAGE_RENDERERS__: {},
    __1122_CONNECTORS__: { registry: {}, read: async id => health(id) },
    __1122_AUTH__: { isAuthenticated: () => true, authorizationHeaders: () => ({}) },
    __1122_FETCH_JSON__: async url => {
      if (String(url).includes('/profiles')) return { ok: true, profiles: [{ profileId: '账户一', countryCode: '中国', currencyCode: '人民币', timezone: '北京时间', accountId: '店铺一', accountType: '店铺' }] };
      if (String(url).includes('/campaigns')) return { ok: true, campaigns: [], checked_at: '2026-09-20T08:00:00.000Z' };
      if (String(url).includes('/ad-groups')) return { ok: true, ad_groups: [], checked_at: '2026-09-20T08:00:00.000Z' };
      return { total: 0, items: [], source_status: 'LIVE_D1_READ' };
    },
    dispatchEvent() {},
    crypto: { randomUUID: () => '请求一' }
  };
  const context = vm.createContext({
    window,
    document,
    Intl,
    URLSearchParams,
    Date,
    Math,
    performance: { now: () => 1 },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: callback => callback(),
    navigator: { clipboard: { writeText: async () => {} } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  });
  for (const source of pageSources) vm.runInContext(source, context);
  window.__1122_CONNECTORS__ = { registry: Object.fromEntries((window.__1122_REGISTRY__.connectors || []).map(item => [item.connector_id, item])), read: async id => health(id) };
  return window.__1122_PAGE_RENDERERS__;
}

function chineseFixture() {
  return {
    generated_at: '2026-09-20T08:00:00.000Z',
    marketplace: '中国站',
    live_data_verified: true,
    read_only: true,
    execution_authorized: false,
    production_write_authorized: false,
    products: [{
      product_id: '商品一', asin: '商品编号一', sku: '商品编码一', title: '测试商品', brand: '测试品牌', fulfillment_channel: '仓配',
      business_date: '2026-09-20', stage: '增长期', primary_goal: '提升转化', sales: 10, units: 2, orders_count: 1,
      sessions: 10, page_views: 12, conversion_rate: 0.1, ad_spend: 1, acos: 0.1, tacos: 0.1,
      fulfillable_inventory: 5, inbound_inventory: 1, coverage_days: 5, rating: 4.5, review_count: 2,
      contribution_profit: 3, profit_margin: 0.3, currency: 'CNY'
    }],
    agents: [{ agent_id: '智能助手一', component: '运行组件', status: 'LIVE', freshness_status: 'FRESH', last_success_at: '2026-09-20T08:00:00.000Z', runtime_version: '一', updated_at: '2026-09-20T08:00:00.000Z' }],
    tasks: [{ task_id: '任务一', product_id: '商品一', task_type: '审核', task_status: 'PENDING_APPROVAL', approval_status: 'PENDING', updated_at: '2026-09-20T08:00:00.000Z' }],
    promotion_plans: [{
      plan_id: '计划一', asin: '商品编号一', plan_status: 'ACTIVE',
      stage_assessment: { current_stage: '增长期', confidence: 0.8, reason: '样本充分', supporting_evidence: [], missing_evidence: [] },
      constraint_assessment: { primary_constraint: '待补充数据', reason: '暂无约束', secondary_constraints: [], supporting_evidence: [] },
      strategy_assessment: { primary_strategy: '保持观察', strategy_reason: '持续验证', recommended_actions: [], avoid_actions: [] },
      goals: { primary_goal: '提升转化' }, constraints: {}, milestones: [], action_cooldown: [], review: {}
    }],
    daily_operating_briefs: [{
      brief_id: '简报一', asin_scope: ['商品编号一'], overall_status: 'PENDING', today_focus: ['检查数据'], blocked_by: [],
      strategy_context: { current_stage: '增长期', primary_goal: '提升转化', primary_constraint: '待补充数据', current_strategy: '保持观察', avoid_actions: [] },
      signals: [], root_cause_assessments: [], actions: [], action_validation: [], stage_review: {}, data_status: { status: 'LIVE_D1_READ' }
    }],
    apr: [{ apr_id: '观察一', domain: '评价', pattern_name_cn: '评价观察', business_goal: '提升体验', observed_effect: '持续观察', policy_relation: 'CONDITIONAL', business_value_signal: 'POSITIVE', confidence: 'LOW', detection_signals: [] }],
    aom: [{ method_id: '方法一', method_name_cn: '合规方法', objective: '提升体验', impact: '持续观察', policy_status: 'VERIFIED_ALLOWED', risk_level: 'LOW', measurement: ['评价数'] }],
    apb: [{ case_id: '证据一', domain: '评价', result_type: 'POLICY_EVIDENCE', status: 'SEEDED', title_cn: '政策证据', confidence: 'MEDIUM' }],
    domains: [['01', '评价', '评价', 'SEEDED']],
    sandbox_runs: [],
    knowledge: { total: 0, by_type: [], by_truth: [], source_status: 'LIVE_D1_READ' },
    __source: { source_status: {
      d1: 'LIVE_D1_READ', products: 'LIVE_D1_READ', tasks: 'LIVE_D1_READ', agents: 'LIVE_D1_READ',
      promotion_plans: 'LIVE_D1_READ', daily_operating_briefs: 'LIVE_D1_READ', apr: 'LIVE_D1_READ', aom: 'LIVE_D1_READ', apb: 'LIVE_D1_READ'
    } }
  };
}

function renderedText(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&(?:amp|lt|gt|quot|#039);/g, ' ').replace(/\s+/g, ' ').trim();
}

test('core rendered interface does not emit static English for a Chinese data fixture', async () => {
  const renderers = makeHarness();
  const data = chineseFixture();
  const routes = [
    '/command-center', '/operations/products', '/products/商品一', '/products/商品一/policy-impact',
    '/operations/products/promotion-plan', '/operations/daily-sop', '/amazon-boundary/apr', '/amazon-boundary/aom', '/amazon-boundary/apb',
    '/selection', '/operations/inventory-logistics', '/operations/competitors', '/operations/offsite', '/sandbox', '/governance', '/skills',
    '/memory', '/data', '/connectors/amazon-sp-api', '/amazon-boundary', '/system/overview', '/system/ui-design', '/system/conflicts',
    '/connectors', '/connectors/amazon-ads', '/knowledge'
  ];

  for (const route of routes) {
    const renderer = renderers[route]
      || (route.endsWith('/policy-impact') ? renderers['/products/:product_id/policy-impact'] : null)
      || (route.startsWith('/products/') ? renderers['/products/:product_id'] : null);
    assert.ok(renderer, `missing renderer for ${route}`);
    const view = { innerHTML: '' };
    await renderer({ data, route, query: new URLSearchParams('product_id=商品一'), view, setChrome: () => {}, isCurrent: () => true });
    const words = renderedText(view.innerHTML).match(/[A-Za-z]{2,}/g) || [];
    assert.deepEqual(words, [], `${route} emitted English UI text: ${words.join(', ')}`);
  }
});
