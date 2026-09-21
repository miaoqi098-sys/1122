const EVENT_TO_SIGNAL = {
  AMAZON_SESSIONS_DROP: 'TRAFFIC_DROP',
  MARKET_TRAFFIC_DROP: 'TRAFFIC_DROP',
  AD_TRAFFIC_DROP: 'TRAFFIC_DROP',
  NATURAL_TRAFFIC_DROP: 'ORGANIC_SHARE_DROP',
  CONVERSION_DROP: 'CVR_DROP',
  INVENTORY_COVERAGE_LOW: 'STOCKOUT_RISK',
  PRICE_CHANGE: 'PRICE_HEALTH_RISK',
  BSR_DETERIORATION: 'KEYWORD_RANK_DROP',
};

const ROOT_CAUSE_LABELS = {
  TRAFFIC_CONSTRAINT: '流量侧异常：需要核对广告曝光、预算、自然排名与市场需求。',
  CONVERSION_CONSTRAINT: '转化侧异常：需要核对价格、促销、Review、Listing、配送与流量质量。',
  TRAFFIC_AND_CONVERSION_CONSTRAINT: '流量与转化同时下降：需要优先检查可售状态、价格、Review、Listing 与广告覆盖。',
  INVENTORY_CONSTRAINT: '库存覆盖风险：需要先保护库存，再评估补货与流量节奏。',
  PRICE_CONSTRAINT: '价格发生显著变化：需要核对价格健康、促销与 Buy Box，再判断是否影响转化。',
  RANKING_CONSTRAINT: '自然流量或排名恶化：需要核对成交、广告覆盖、竞品与可售状态。',
  UNRESOLVED: '当前证据不足以确认单一根因。',
};

const PRIORITY = { P0: 0, P1: 1, P2: 2, P3: 3 };

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseJson(value, fallback = {}) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function eventEvidence(event) {
  const evidence = parseJson(event.evidence_json, {});
  return {
    event_id: event.event_id,
    event_type: event.event_type,
    metric_key: evidence.metricKey || null,
    current_value: asNumber(evidence.currentValue),
    baseline_7d: asNumber(evidence.baseline7d),
    delta_pct: asNumber(evidence.deltaPct),
    threshold: evidence.threshold || null,
  };
}

function signalSeverity(event, product) {
  if (event.event_type === 'INVENTORY_COVERAGE_LOW') {
    const coverageDays = asNumber(product?.coverage_days);
    if (coverageDays !== null && coverageDays < 15) return coverageDays <= 7 ? 'P0' : 'P1';
  }
  return String(event.severity || '').toUpperCase() === 'HIGH' ? 'P1' : 'P2';
}

function comparePriority(left, right) {
  return PRIORITY[left] - PRIORITY[right];
}

function metricWindow(stateValue, metric) {
  return {
    current: asNumber(metric?.metric_value) ?? asNumber(stateValue),
    d1: asNumber(metric?.prior_value),
    d7: asNumber(metric?.baseline_7d),
    delta_vs_d7: asNumber(metric?.delta_pct),
    status: metric?.signal || null,
  };
}

function buildSignals({ product, events = [] }) {
  return events
    .map((event) => {
      const signalType = EVENT_TO_SIGNAL[event.event_type];
      if (!signalType) return null;
      const evidence = eventEvidence(event);
      const fact = evidence.metric_key
        ? `${evidence.metric_key} 出现 ${event.event_type}。`
        : `检测到 ${event.event_type}。`;
      return {
        signal_id: `SIG:${event.event_id}`,
        signal_type: signalType,
        severity: signalSeverity(event, product),
        asin: product?.asin || null,
        fact,
        confidence: evidence.baseline_7d === null ? 0.5 : 0.8,
        evidence_window: evidence.baseline_7d === null ? '当前观测窗口' : '当前值 vs 近 7 天基线',
        evidence_refs: [`d1:events:${event.event_id}`],
        affected_goal: null,
        stage_relevance: null,
        status: 'OPEN',
      };
    })
    .filter(Boolean)
    .sort((left, right) => comparePriority(left.severity, right.severity));
}

function rootCauseFor(signals) {
  const types = new Set(signals.map((signal) => signal.signal_type));
  if (types.has('STOCKOUT_RISK')) return { code: 'INVENTORY_CONSTRAINT', confidence: 0.9 };
  if (types.has('TRAFFIC_DROP') && types.has('CVR_DROP')) return { code: 'TRAFFIC_AND_CONVERSION_CONSTRAINT', confidence: 0.8 };
  if (types.has('TRAFFIC_DROP')) return { code: 'TRAFFIC_CONSTRAINT', confidence: 0.75 };
  if (types.has('CVR_DROP')) return { code: 'CONVERSION_CONSTRAINT', confidence: 0.75 };
  if (types.has('PRICE_HEALTH_RISK')) return { code: 'PRICE_CONSTRAINT', confidence: 0.65 };
  if (types.has('ORGANIC_SHARE_DROP') || types.has('KEYWORD_RANK_DROP')) return { code: 'RANKING_CONSTRAINT', confidence: 0.65 };
  return { code: 'UNRESOLVED', confidence: 0 };
}

function buildRootCauseAssessments(signals) {
  const highPriority = signals.filter((signal) => ['P0', 'P1'].includes(signal.severity));
  if (!highPriority.length) return [];
  const conclusion = rootCauseFor(highPriority);
  const refs = highPriority.flatMap((signal) => signal.evidence_refs || []);
  return highPriority.map((signal) => ({
    signal_id: signal.signal_id,
    primary_root_cause: conclusion.code,
    root_cause_candidates: [conclusion.code],
    confidence: conclusion.confidence,
    supporting_evidence: refs,
    contradicting_evidence: [],
    missing_evidence: conclusion.code === 'UNRESOLVED'
      ? ['需要补齐流量、转化、价格、库存与可售状态事实。']
      : [],
    status: conclusion.code === 'UNRESOLVED' ? 'NEEDS_DATA' : 'ASSESSED',
    reason: ROOT_CAUSE_LABELS[conclusion.code],
  }));
}

function action(actionId, actionType, text, why, evidence, expectedResult, observationWindow, stopCondition, approvalLevel = 'L0') {
  return {
    action_id: actionId,
    action_type: actionType,
    action: text,
    why,
    evidence,
    expected_result: expectedResult,
    observation_window: observationWindow,
    stop_condition: stopCondition,
    avoid_if: [],
    cooldown_until: null,
    approval_level: approvalLevel,
    decision_item_required: approvalLevel !== 'L0',
    status: 'SUGGESTED',
  };
}

function buildActions({ product, plan, signals, rootCauseAssessments, dataStatus }) {
  const rootCause = rootCauseAssessments[0]?.primary_root_cause || null;
  const refs = signals.flatMap((signal) => signal.evidence_refs || []);
  if (dataStatus !== 'DATA_READY') {
    return [action(
      `ACT:${product.product_id}:NEEDS_DATA`,
      'NEEDS_DATA',
      '补齐当日经营数据后保持观察。',
      '当前数据不足，不能将单日变化直接转为经营操作。',
      refs,
      '形成可验证的日度事实与信号。',
      '下一次数据刷新后',
      '数据完整性满足每日检查要求。',
    )];
  }
  if (!plan) {
    return [action(
      `ACT:${product.product_id}:NEEDS_PLAN`,
      'NEEDS_PLAN',
      '补充产品推广计划后再生成经营调整建议。',
      '没有正式推广计划时可以做健康检查，但不能自行假定产品目标、阶段或策略。',
      refs,
      '形成含阶段、目标、约束与避免动作的策略上下文。',
      '计划生效后',
      '正式推广计划已接入。',
    )];
  }
  if (rootCause === 'INVENTORY_CONSTRAINT') {
    return [action(
      `ACT:${product.product_id}:INVENTORY_REVIEW`,
      'INVENTORY_REVIEW',
      '创建补货与库存保护评估任务；在审批前不扩大探索流量。',
      '库存覆盖风险高于扩量目标，需先保护可售周期。',
      refs,
      '确认补货计划，并避免非核心流量加速断货。',
      '1 个工作日',
      '补货计划已审批或库存覆盖恢复至 15 天以上。',
      'L1',
    )];
  }
  if (rootCause === 'TRAFFIC_AND_CONVERSION_CONSTRAINT') {
    return [action(
      `ACT:${product.product_id}:DIAGNOSE_TRAFFIC_CVR`,
      'DIAGNOSE_TRAFFIC_CVR',
      '创建联合诊断任务：核对可售状态、价格、Review、Listing、广告曝光与预算。',
      '流量与转化同时下降，属于当天优先处理的经营偏差。',
      refs,
      '确认主要约束，避免同时改变多个核心变量。',
      '1 个工作日',
      '根因已确认，或发现账户、Listing、Buy Box、合规等更高优先级问题。',
      'L1',
    )];
  }
  if (rootCause === 'TRAFFIC_CONSTRAINT' || rootCause === 'RANKING_CONSTRAINT') {
    return [action(
      `ACT:${product.product_id}:DIAGNOSE_TRAFFIC`,
      'DIAGNOSE_TRAFFIC',
      '创建流量诊断任务：核对广告曝光、预算、核心词排名与市场需求。',
      ROOT_CAUSE_LABELS[rootCause],
      refs,
      '区分自然流量、广告曝光与预算限制。',
      '1 个工作日',
      '找到可验证的流量根因，或数据不足。',
      'L1',
    )];
  }
  if (rootCause === 'CONVERSION_CONSTRAINT' || rootCause === 'PRICE_CONSTRAINT') {
    return [action(
      `ACT:${product.product_id}:DIAGNOSE_CONVERSION`,
      'DIAGNOSE_CONVERSION',
      '创建转化诊断任务：核对价格、Coupon、Review、主图、Listing、配送与流量质量。',
      ROOT_CAUSE_LABELS[rootCause],
      refs,
      '确认转化下降是否由报价、页面竞争力或流量质量导致。',
      '1 个工作日',
      '根因已确认；不要在诊断期同时改价格、主图和广告。',
      'L1',
    )];
  }
  return [action(
    `ACT:${product.product_id}:KEEP_OBSERVING`,
    'KEEP_OBSERVING',
    '保持观察，不进行经营参数修改。',
    '当前没有需要立即处理的高优先级信号；“今天不改”是合法结论。',
    refs,
    '继续保留可用于趋势判断的最小样本。',
    '下一个日度窗口',
    '出现高优先级信号或达到计划复核点。',
  )];
}

function dataSources({ product, metrics, plan }) {
  return [
    { source: 'product_daily_state', status: product?.business_date ? 'READY' : 'MISSING', last_success_at: product?.state_observed_at || null, freshness: product?.business_date ? 'BUSINESS_DATE_AVAILABLE' : null, notes: null },
    { source: 'product_daily_metrics', status: metrics.length ? 'READY' : 'MISSING', last_success_at: metrics[0]?.computed_at || null, freshness: metrics.length ? 'CURRENT_BUSINESS_DATE' : null, notes: null },
    { source: 'product_operating_plan', status: plan ? 'READY' : 'MISSING', last_success_at: plan?.updated_at || null, freshness: plan ? 'ACTIVE_PLAN_AVAILABLE' : null, notes: plan ? null : '缺少正式产品推广计划。' },
  ];
}

function buildValidation(validations = []) {
  return validations.map((validation) => ({
    action_id: validation.task_id || validation.validation_id,
    baseline: parseJson(validation.expected_json, null),
    executed_at: validation.task_updated_at || null,
    expected_result: validation.expected_json || null,
    observed_result: validation.observed_json || validation.result_status || null,
    observation_window: null,
    guardrail: null,
    rollback_condition: null,
    validation_status: ['PENDING', 'POSITIVE', 'NEUTRAL', 'NEGATIVE', 'INSUFFICIENT_DATA', 'SIDE_EFFECT_DETECTED'].includes(validation.result_status)
      ? validation.result_status
      : 'INSUFFICIENT_DATA',
    next_step: null,
  }));
}

export function buildDailyOperatingBrief({ product, plan = null, metrics = [], events = [], validations = [] }) {
  const businessDate = product?.business_date || null;
  const metricByKey = new Map(metrics.map((metric) => [metric.metric_key, metric]));
  const sourceEntries = dataSources({ product, metrics, plan });
  const dataStatus = product?.business_date && metrics.length ? 'DATA_READY' : 'DATA_INCOMPLETE';
  const signals = buildSignals({ product, events });
  const rootCauseAssessments = buildRootCauseAssessments(signals);
  const actions = buildActions({ product, plan, signals, rootCauseAssessments, dataStatus });
  const highestSeverity = signals[0]?.severity || null;
  const overallStatus = highestSeverity === 'P0'
    ? 'RED'
    : highestSeverity === 'P1' || dataStatus !== 'DATA_READY'
      ? 'YELLOW'
      : 'GREEN';
  const planConstraints = parseJson(plan?.constraints_json, {});
  const primaryConstraint = typeof planConstraints.primary_constraint === 'string' ? planConstraints.primary_constraint : 'NEEDS_DATA';

  return {
    brief_id: `DOB:${product.product_id}:${businessDate || 'UNKNOWN'}`,
    version: '2.0',
    date: businessDate,
    marketplace: product.marketplace,
    seller_scope: null,
    asin_scope: product.asin ? [product.asin] : [],
    promotion_plan_refs: plan?.plan_id ? [plan.plan_id] : [],
    data_status: { status: dataStatus, sources: sourceEntries },
    strategy_context: {
      current_stage: plan?.stage || 'NEEDS_DATA',
      stage_confidence: null,
      primary_constraint: primaryConstraint,
      constraint_confidence: null,
      primary_goal: plan?.primary_goal || 'NEEDS_DATA',
      current_strategy: plan?.strategy || null,
      avoid_actions: [],
      transition_candidate: null,
      regression_candidate: null,
    },
    overall_status: overallStatus,
    today_focus: actions.map((item) => item.action),
    blocked_by: sourceEntries.filter((source) => source.status === 'MISSING').map((source) => source.source),
    metrics: {
      sales: metricWindow(product.sales, metricByKey.get('amazon.sales')),
      sessions: metricWindow(product.sessions, metricByKey.get('amazon.sessions')),
      conversion_rate: metricWindow(product.conversion_rate, metricByKey.get('amazon.conversion_rate')),
      ad_spend: metricWindow(product.ad_spend, metricByKey.get('amazon.ad_spend')),
      tacos: metricWindow(product.tacos, metricByKey.get('amazon.tacos')),
      coverage_days: metricWindow(product.coverage_days, metricByKey.get('inventory.coverage_days')),
      contribution_profit: metricWindow(product.contribution_profit, metricByKey.get('finance.contribution_profit')),
    },
    signals,
    root_cause_assessments: rootCauseAssessments,
    actions,
    tasks: [],
    action_validation: buildValidation(validations),
    stage_review: {
      transition_candidate: null,
      regression_candidate: null,
      constraint_changed: false,
      new_primary_constraint: null,
      strategy_refresh_required: false,
      reason: plan ? '尚未接入正式阶段评估与策略刷新结论。' : '缺少正式产品推广计划，不能评估阶段切换。',
    },
    change_collision_check: { status: 'WARNING', recent_major_changes: [], conflicts: ['尚未接入动作冷却期与变更冲突事实。'] },
    audit: { source: 'daily-operating-brief-v1', read_only: true, execution_authorized: false },
  };
}
