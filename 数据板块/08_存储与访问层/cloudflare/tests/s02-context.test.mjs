import assert from 'node:assert/strict';
import {
  planContextDomains,
  runS02,
  S02_RUNTIME_VERSION,
} from '../../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S02_上下文装载/执行程序/runtime.js';

const event = {
  event_id: 'evt-s02-test',
  source_type: 'system',
  source_agent: null,
  source_actor: '1122-derived-layer',
  source_ref: 'evt-s02-test',
  scope_type: 'product',
  scope_id: 'product-1',
  product_id: 'product-1',
  asin: 'B0TESTS02',
  scope_objects: [{ object_type: 'product', product_id: 'product-1', asin: 'B0TESTS02', marketplace: 'US' }],
  event_type: 'AMAZON_SESSIONS_DROP',
  severity: 'P1',
  occurred_at: '2026-09-01T12:00:00Z',
  summary: 'B0TESTS02 Sessions 相对7日基线下降25%。',
  facts: ['amazon.sessions 当前值75，7日基线100，相对基线下降25%。'],
};

const s01 = {
  status: 'passed',
  warnings: [],
  duplicate_signal: { is_possible_duplicate: false, matched_event_ids: [] },
};
const request = {
  question: '判断流量下降是否需要干预。',
  max_context_items: 100,
  max_context_tokens: 12000,
};

const plan = planContextDomains(event, request);
const priorities = Object.fromEntries(plan.map((x) => [x.domain, x.priority]));
assert.equal(priorities.C01, 'P0');
assert.equal(priorities.C02, 'P0');
assert.equal(priorities.C04, 'P0');
assert.equal(priorities.C05, 'P0');
assert.equal(priorities.C08, 'P1');

function loaded(domain, data = {}) {
  return {
    status: 'loaded', freshness: 'fresh', as_of: '2026-09-01T12:00:00Z',
    source: 'test', item_count: 1, refs: [`test:${domain}`], data,
  };
}

const allAvailable = Object.fromEntries(plan.map((x) => [x.domain, loaded(x.domain, { domain: x.domain })]));
const ready = runS02({ validated_event: event, s01_validation: s01, context_request: request, available_context: allAvailable, current_time: '2026-09-01T13:00:00Z' });
assert.equal(ready.status, 'ready');
assert.equal(ready.next_action, 'continue_analysis');
assert.equal(ready.runtime_version, S02_RUNTIME_VERSION);
assert.equal(ready.scope.product_id, 'product-1');
assert.ok(ready.context_package.C01_product_identity);
assert.ok(ready.context_package.C04_core_metrics);
assert.equal(ready.context_refs.length, plan.length);

const noHistory = { ...allAvailable, C06: { status: 'missing', reason: '新品尚无历史。' } };
const withHistoryGap = runS02({ validated_event: event, s01_validation: s01, context_request: request, available_context: noHistory });
assert.equal(withHistoryGap.status, 'ready_with_gaps');
assert.notEqual(withHistoryGap.status, 'blocked');
assert.ok(withHistoryGap.missing_context.some((x) => x.domain === 'C06'));

const noBusinessState = { ...allAvailable, C02: { status: 'missing', reason: '状态数据源暂不可用。' } };
const needsInfo = runS02({ validated_event: event, s01_validation: s01, context_request: request, available_context: noBusinessState });
assert.equal(needsInfo.status, 'needs_information');
assert.equal(needsInfo.next_action, 'request_information');

const staleState = { ...allAvailable, C02: { ...allAvailable.C02, freshness: 'stale', reason: '当前经营状态超过新鲜度阈值。' } };
const refresh = runS02({ validated_event: event, s01_validation: s01, context_request: request, available_context: staleState });
assert.equal(refresh.status, 'needs_information');
assert.equal(refresh.next_action, 'refresh_context');

const noIdentity = { ...allAvailable, C01: { status: 'missing', reason: '产品不存在。' } };
const blocked = runS02({ validated_event: event, s01_validation: s01, context_request: request, available_context: noIdentity });
assert.equal(blocked.status, 'blocked');
assert.equal(blocked.next_action, 'hold_for_review');

const inventoryEvent = { ...event, event_id: 'evt-inventory', event_type: 'INVENTORY_COVERAGE_LOW' };
const inventoryPlan = planContextDomains(inventoryEvent, request);
const inventoryPriorities = Object.fromEntries(inventoryPlan.map((x) => [x.domain, x.priority]));
assert.equal(inventoryPriorities.C10, 'P0');
assert.equal(inventoryPriorities.C03, 'P0');

console.log(JSON.stringify({
  success: true,
  runtimeVersion: S02_RUNTIME_VERSION,
  trafficPlan: priorities,
  readyStatus: ready.status,
  noHistoryStatus: withHistoryGap.status,
  missingStateStatus: needsInfo.status,
  staleStateStatus: refresh.status,
  missingIdentityStatus: blocked.status,
  inventoryPlan: inventoryPriorities,
}, null, 2));
