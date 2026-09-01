export const S02_RUNTIME_VERSION = 'S02-runtime-v1.2.0';

export const DOMAIN_KEYS = {
  C01: 'C01_product_identity',
  C02: 'C02_business_state',
  C03: 'C03_current_goals',
  C04: 'C04_core_metrics',
  C05: 'C05_events_and_promotions',
  C06: 'C06_product_history',
  C07: 'C07_agent_analyses',
  C08: 'C08_market_and_competitors',
  C09: 'C09_business_knowledge',
  C10: 'C10_active_tasks_and_constraints',
};

const ALL_DOMAINS = Object.keys(DOMAIN_KEYS);
const READY_S01 = new Set(['passed', 'passed_with_warnings']);
const PRODUCT_SCOPES = new Set(['product', 'parent_product', 'sku']);

function unique(values) {
  return [...new Set(values)];
}

function normalizePriority(value) {
  return ['P0', 'P1', 'P2', 'P3'].includes(value) ? value : 'P2';
}

function addPlan(map, domain, priority, reason) {
  if (!ALL_DOMAINS.includes(domain)) return;
  const current = map.get(domain);
  const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
  if (!current || order[priority] < order[current.priority]) {
    map.set(domain, { domain, priority, reason });
  }
}

function classifyEvent(eventType = '') {
  const t = String(eventType).toUpperCase();
  if (/INVENTORY|STOCK|OUT_OF_STOCK|COVERAGE/.test(t)) return 'inventory';
  if (/PRICE|BD|LD|DEAL|COUPON|PROMOTION/.test(t)) return 'price';
  if (/CONVERSION|CVR|ORDER_RATE/.test(t)) return 'conversion';
  if (/SESSIONS|NATURAL_TRAFFIC|MARKET_TRAFFIC|AD_TRAFFIC|RANK|BSR|TRAFFIC/.test(t)) return 'traffic';
  if (/LISTING|COMPLIANCE|FROZEN|SUPPRESSED|QUALIFICATION/.test(t)) return 'compliance';
  if (/PROFIT|MARGIN|FEE|COST|TACOS|ACOS/.test(t)) return 'profit';
  if (/RATING|REVIEW|RETURN|REFUND/.test(t)) return 'reputation';
  if (/COMPETITOR|MARKET_OPPORTUNITY|GROWTH_OPPORTUNITY/.test(t)) return 'market';
  return 'general';
}

export function planContextDomains(validatedEvent = {}, contextRequest = {}) {
  const plan = new Map();
  const category = classifyEvent(validatedEvent.event_type);

  // Product identity is a hard prerequisite whenever the event is product-scoped.
  if (PRODUCT_SCOPES.has(validatedEvent.scope_type)) {
    addPlan(plan, 'C01', 'P0', '产品作用域必须先确认经营对象与身份。');
  }

  const add = (domain, priority, reason) => addPlan(plan, domain, priority, reason);

  if (category === 'inventory') {
    add('C02', 'P0', '库存风险必须确认当前经营状态和库存状态。');
    add('C03', 'P0', '库存动作必须结合当前经营目标与阶段。');
    add('C04', 'P0', '需要销量、库存覆盖天数等直接指标。');
    add('C05', 'P0', '促销/放量背景可能改变库存风险判断。');
    add('C10', 'P0', '补货任务、观察窗口和限制属于硬约束。');
    add('C06', 'P1', '历史销量与库存变化用于估计风险。');
    add('C07', 'P1', '专业供应链结论可提高判断质量。');
  } else if (category === 'price') {
    add('C02', 'P0', '价格决策必须确认当前经营状态。');
    add('C03', 'P0', '价格动作必须服务当前目标。');
    add('C04', 'P0', '价格、销量、转化和库存等指标直接影响方案。');
    add('C05', 'P0', '活动/促销背景必须与正常期分开。');
    add('C10', 'P0', '当前任务、审批和经营限制属于硬约束。');
    add('C06', 'P1', '价格历史与同类决策结果可辅助判断。');
    add('C08', 'P1', '市场与竞品价格信号可改变方案排序。');
  } else if (category === 'conversion') {
    add('C02', 'P0', '转化异常需要当前经营状态。');
    add('C04', 'P0', 'Sessions、CVR、订单和销量是直接证据。');
    add('C05', 'P0', '活动、价格和Listing变更可能解释转化变化。');
    add('C03', 'P1', '当前目标用于判断异常是否值得干预。');
    add('C06', 'P1', '历史转化基线用于区分短期波动。');
    add('C07', 'P1', '相关专业Agent结论可复用但必须检查新鲜度。');
    add('C10', 'P1', '正在执行的测试窗口可防止过早干预。');
  } else if (category === 'traffic') {
    add('C02', 'P0', '流量异常需要当前经营状态。');
    add('C04', 'P0', '当前流量、转化和市场可见度指标是直接证据。');
    add('C05', 'P0', '活动/改版/价格变化会改变流量解释。');
    add('C03', 'P1', '当前目标用于判断是否需要干预。');
    add('C06', 'P1', '历史基线用于区分趋势与噪声。');
    add('C08', 'P1', 'Sif市场/关键词/广告结构信号可区分市场变化与自身变化。');
    add('C07', 'P2', '专业Agent结论为辅助解释。');
    add('C10', 'P1', '当前测试或任务窗口可能要求继续观察。');
  } else if (category === 'compliance') {
    add('C02', 'P0', 'Listing/合规事件必须确认当前可售状态。');
    add('C03', 'P0', '当前阶段和目标决定处置优先级。');
    add('C05', 'P0', '相关异常事件和状态变化必须装载。');
    add('C10', 'P0', '审批、恢复任务和限制属于硬约束。');
    add('C06', 'P1', '历史冻结/恢复记录可辅助判断。');
    add('C07', 'P1', '合规专业Agent结论可作为高价值上下文。');
  } else if (category === 'profit') {
    add('C02', 'P0', '利润异常需要当前经营状态。');
    add('C03', 'P0', '利润动作必须对齐经营目标。');
    add('C04', 'P0', '利润、销量、价格、广告等核心指标是直接证据。');
    add('C05', 'P0', '活动期与正常期必须分开。');
    add('C10', 'P1', '当前任务和约束可能限制可选动作。');
    add('C06', 'P1', '历史利润与价格变化用于确认趋势。');
  } else if (category === 'reputation') {
    add('C02', 'P0', '评价/退货异常需要当前产品经营状态。');
    add('C04', 'P0', 'Rating、Review、退款等指标是直接证据。');
    add('C05', 'P1', '近期改版或活动可能影响消费者反馈。');
    add('C06', 'P1', '历史趋势用于判断是否持续恶化。');
    add('C07', 'P1', '消费者体验专业分析可提高解释质量。');
    add('C09', 'P2', '经营知识只作为辅助，不替代事实。');
  } else if (category === 'market') {
    add('C02', 'P0', '增长/竞品问题必须结合自身经营状态。');
    add('C03', 'P0', '机会是否值得做取决于当前目标。');
    add('C08', 'P0', '市场与竞品是问题的直接事实域。');
    add('C04', 'P1', '自身核心指标用于判断承接能力。');
    add('C10', 'P1', '当前任务和限制影响机会落地。');
    add('C06', 'P2', '历史用于辅助判断机会持续性。');
  } else {
    add('C02', 'P0', '默认需要当前经营状态。');
    add('C04', 'P0', '默认需要与事件直接相关的核心指标。');
    add('C05', 'P0', '默认需要近期事件与经营背景。');
    add('C03', 'P1', '当前目标帮助判断事件影响。');
    add('C06', 'P1', '历史基线帮助判断是否异常。');
    add('C10', 'P1', '当前任务和限制帮助避免动作冲突。');
  }

  for (const domain of Array.isArray(contextRequest.requested_domains) ? contextRequest.requested_domains : []) {
    add(domain, plan.get(domain)?.priority || 'P1', 'context_request 显式请求。');
  }

  return [...plan.values()].sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return order[a.priority] - order[b.priority] || a.domain.localeCompare(b.domain);
  });
}

function envelopeStatus(envelope) {
  if (!envelope || typeof envelope !== 'object') return 'missing';
  return String(envelope.status || 'loaded').toLowerCase();
}

function normalizeRefs(envelope) {
  return Array.isArray(envelope?.refs) ? envelope.refs.map(String) : [];
}

function contextItemCount(envelope) {
  if (Number.isFinite(Number(envelope?.item_count))) return Number(envelope.item_count);
  const data = envelope?.data;
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object') return Object.keys(data).length;
  return data === null || data === undefined ? 0 : 1;
}

function makeGap(domainPlan, envelope, kind = 'missing') {
  const reason = String(envelope?.reason || (kind === 'stale' ? '上下文已过期。' : '上下文不可用或尚未建立。'));
  return {
    domain: domainPlan.domain,
    priority: domainPlan.priority,
    reason,
    as_of: envelope?.as_of ?? null,
    freshness: envelope?.freshness ?? 'unknown',
    dependency_status: envelope?.dependency_status ?? null,
    decision_impact: domainPlan.priority === 'P0' ? 'high' : domainPlan.priority === 'P1' ? 'medium' : 'low',
    suggested_action: envelope?.suggested_action || (kind === 'stale' ? 'refresh_context' : 'request_information'),
  };
}

export function runS02(input = {}) {
  const event = input.validated_event;
  const s01 = input.s01_validation || {};
  const request = input.context_request || {};
  const nowIso = (() => {
    const parsed = Date.parse(input.current_time || '');
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  })();

  if (!event || typeof event !== 'object' || !String(event.event_id || '').trim()) {
    return {
      skill_id: 'S02',
      event_id: '',
      scope: { scope_type: 'global', scope_id: null, product_id: null, asin: null },
      status: 'blocked',
      question: String(request.question || ''),
      planned_domains: [],
      context_package: {},
      loaded_items: [],
      missing_context: [{ domain: 'EVENT', priority: 'P0', reason: 'validated_event 缺失或不可解析。' }],
      stale_context: [],
      excluded_context: [],
      context_refs: [],
      context_summary: 'S02 无法开始：没有有效的 S01 normalized_event。',
      next_action: 'hold_for_review',
      runtime_version: S02_RUNTIME_VERSION,
      generated_at: nowIso,
    };
  }

  if (!READY_S01.has(s01.status)) {
    return {
      skill_id: 'S02',
      event_id: String(event.event_id),
      scope: {
        scope_type: event.scope_type || 'global',
        scope_id: event.scope_id ?? null,
        product_id: event.product_id ?? null,
        asin: event.asin ?? null,
      },
      status: 'blocked',
      question: String(request.question || ''),
      planned_domains: [],
      context_package: {},
      loaded_items: [],
      missing_context: [{ domain: 'S01', priority: 'P0', reason: '只有 passed / passed_with_warnings 事件可以进入 S02。' }],
      stale_context: [],
      excluded_context: [],
      context_refs: [],
      context_summary: 'S02 被阻断：S01 尚未通过。',
      next_action: 'hold_for_review',
      runtime_version: S02_RUNTIME_VERSION,
      generated_at: nowIso,
    };
  }

  const plannedDomains = planContextDomains(event, request);
  const available = input.available_context && typeof input.available_context === 'object'
    ? input.available_context
    : {};
  const contextPackage = {};
  const loadedItems = [];
  const missing = [];
  const stale = [];
  const refs = [];

  for (const plan of plannedDomains) {
    const envelope = available[plan.domain];
    const status = envelopeStatus(envelope);
    const freshness = String(envelope?.freshness || 'unknown').toLowerCase();
    if (status === 'loaded' || status === 'partial' || status === 'ready') {
      if (envelope && Object.prototype.hasOwnProperty.call(envelope, 'data')) {
        contextPackage[DOMAIN_KEYS[plan.domain]] = envelope.data;
      }
      loadedItems.push({
        domain: plan.domain,
        priority: plan.priority,
        status,
        freshness,
        as_of: envelope?.as_of ?? null,
        item_count: contextItemCount(envelope),
        source: envelope?.source ?? null,
      });
      refs.push(...normalizeRefs(envelope));
      if (freshness === 'stale') stale.push(makeGap(plan, envelope, 'stale'));
      if (status === 'partial') missing.push(makeGap(plan, {
        ...envelope,
        reason: envelope?.reason || '该上下文域只装载了部分可用数据。',
      }));
    } else {
      missing.push(makeGap(plan, envelope, 'missing'));
    }
  }

  const plannedSet = new Set(plannedDomains.map((x) => x.domain));
  const excluded = ALL_DOMAINS
    .filter((domain) => !plannedSet.has(domain))
    .map((domain) => ({ domain, reason: '与当前问题的决策依赖相关性不足，未进入最小充分上下文。' }));

  const criticalMissing = missing.filter((x) => x.priority === 'P0');
  const criticalStale = stale.filter((x) => x.priority === 'P0');
  const productScopeWithoutIdentity = PRODUCT_SCOPES.has(event.scope_type)
    && (!contextPackage.C01_product_identity || envelopeStatus(available.C01) === 'missing');

  let status;
  let nextAction;
  if (productScopeWithoutIdentity) {
    status = 'blocked';
    nextAction = 'hold_for_review';
  } else if (criticalMissing.length || criticalStale.length) {
    status = 'needs_information';
    nextAction = criticalStale.length ? 'refresh_context' : 'request_information';
  } else if (missing.length || stale.length || s01.status === 'passed_with_warnings') {
    status = 'ready_with_gaps';
    const agentGap = missing.some((x) => x.domain === 'C07' && x.priority === 'P1');
    nextAction = agentGap ? 'request_agent_analysis' : 'continue_analysis';
  } else {
    status = 'ready';
    nextAction = 'continue_analysis';
  }

  const loadedDomains = loadedItems.map((x) => x.domain).join(', ') || '无';
  const gapSummary = missing.length || stale.length
    ? `缺口 ${missing.length} 项，过期 ${stale.length} 项。`
    : '无关键上下文缺口。';

  return {
    skill_id: 'S02',
    event_id: String(event.event_id),
    scope: {
      scope_type: event.scope_type,
      scope_id: event.scope_id ?? null,
      product_id: event.product_id ?? null,
      asin: event.asin ?? null,
    },
    status,
    question: String(request.question || `围绕 ${event.event_type} 建立最小充分上下文。`),
    planned_domains: plannedDomains,
    context_package: contextPackage,
    loaded_items: loadedItems,
    missing_context: missing,
    stale_context: stale,
    excluded_context: excluded,
    context_refs: unique(refs),
    context_summary: `已装载：${loadedDomains}。${gapSummary}`,
    next_action: nextAction,
    runtime_version: S02_RUNTIME_VERSION,
    generated_at: nowIso,
  };
}
