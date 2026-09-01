export const S03_RUNTIME_VERSION = 'S03-runtime-v1.2.0';

const CONFLICT_TYPES = new Set(['fact', 'interpretation', 'goal', 'task', 'strategy', 'time_horizon', 'constraint']);
const ELEMENT_TYPES = new Set(['fact', 'analysis', 'recommendation', 'decision', 'task', 'constraint', 'hypothesis']);
const GROWTH_DIRECTIONS = new Set(['increase', 'increase_spend', 'scale', 'expand', 'raise', 'launch', 'resume']);
const ACTIVE_STATUS_RE = /(active|running|in[_ -]?progress|observ|testing|pending[_ -]?validation|执行中|观察|测试|待验证)/i;
const HARD_CONSTRAINT_RE = /(frozen|suppressed|unavailable|prohibit|forbidden|compliance|不可售|冻结|抑制|禁止|合规|不得|硬约束)/i;
const INVENTORY_RE = /(inventory|stock|coverage|days?_of_cover|库存|断货|覆盖)/i;
const PROFIT_RE = /(profit|margin|acos|tacos|利润|毛利|亏损|成本)/i;
const APPROVED_TEST_RE = /(approved|within budget|test budget|批准|预算内|测试预算|观察窗口)/i;

const SEVERITY_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };
const IMPACT_ORDER = { none: 0, confidence_only: 1, changes_ranking: 2, blocks_decision: 3, requires_escalation: 4 };

function arr(value) {
  return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
}

function unique(values) {
  return [...new Set(values.filter((v) => v !== null && v !== undefined && String(v).trim()).map((v) => String(v)))];
}

function text(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function lower(value) {
  return text(value).trim().toLowerCase();
}

function stableValue(value) {
  if (value === undefined) return null;
  if (value && typeof value === 'object') {
    try { return JSON.stringify(value, Object.keys(value).sort()); } catch { return text(value); }
  }
  return value;
}

function normalizeDirection(value) {
  const raw = lower(value).replace(/\s+/g, '_');
  if (!raw) return null;
  if (/(increase|scale|expand|raise|boost|grow|加大|增加|扩量|扩大|提高|放量)/.test(raw)) return raw.includes('spend') || raw.includes('budget') ? 'increase_spend' : 'increase';
  if (/(decrease|reduce|lower|cut|shrink|降|减少|收缩|削减)/.test(raw)) return 'decrease';
  if (/(pause|stop|halt|suspend|暂停|停止|终止)/.test(raw)) return 'pause';
  if (/(resume|restart|continue|恢复|继续)/.test(raw)) return 'resume';
  if (/(launch|start|enable|开启|启动)/.test(raw)) return 'launch';
  return raw;
}

function oppositeDirections(a, b) {
  const x = normalizeDirection(a);
  const y = normalizeDirection(b);
  if (!x || !y || x === y) return false;
  const pairs = new Set([
    'increase|decrease', 'decrease|increase',
    'increase_spend|decrease', 'decrease|increase_spend',
    'pause|resume', 'resume|pause',
    'pause|launch', 'launch|pause',
  ]);
  return pairs.has(`${x}|${y}`);
}

function inferredAgent(source = '') {
  const match = String(source).match(/Agent[-_ ]?\d+/i);
  return match ? match[0].replace(/[_ ]/g, '-') : null;
}

function normalizeElement(raw = {}, fallbackId = 'E') {
  const elementType = ELEMENT_TYPES.has(raw.element_type) ? raw.element_type : 'fact';
  const source = String(raw.source || 'ContextPackage');
  return {
    ...raw,
    element_id: String(raw.element_id || fallbackId),
    element_type: elementType,
    source,
    source_agent: raw.source_agent ?? inferredAgent(source),
    subject: String(raw.subject || raw.topic_or_metric || 'unknown'),
    topic_or_metric: raw.topic_or_metric ?? null,
    value: raw.value === undefined ? null : raw.value,
    unit: raw.unit ?? null,
    time_window: raw.time_window ?? null,
    as_of: raw.as_of ?? null,
    confidence: raw.confidence ?? null,
    goal: raw.goal ?? null,
    action_direction: normalizeDirection(raw.action_direction),
    status: raw.status ?? null,
    evidence_refs: unique(arr(raw.evidence_refs)),
  };
}

function pushDerived(list, raw) {
  if (raw.value === null || raw.value === undefined || raw.value === '') return;
  list.push(normalizeElement(raw, `D${String(list.length + 1).padStart(3, '0')}`));
}

function deriveFromContext(context = {}, contextRefs = []) {
  const out = [];
  const refs = unique(contextRefs);
  const c02 = context.C02_business_state || {};
  const state = c02.current_state || {};
  const inventory = c02.inventory || {};
  for (const [key, value] of Object.entries(state)) {
    if (['price', 'sales', 'units', 'orders_count', 'sessions', 'page_views', 'conversion_rate', 'coverage_days', 'fulfillable_inventory', 'inbound_inventory', 'rating', 'review_count', 'profit_margin', 'primary_goal'].includes(key)) {
      pushDerived(out, { element_type: key === 'primary_goal' ? 'analysis' : 'fact', source: 'S02:C02', subject: key, topic_or_metric: key, value, as_of: state.observed_at || state.business_date || null, evidence_refs: refs });
    }
  }
  for (const [key, value] of Object.entries(inventory)) {
    if (['total_quantity', 'fulfillable_quantity', 'inbound_total_quantity', 'reserved_quantity', 'unfulfillable_quantity'].includes(key)) {
      pushDerived(out, { element_type: 'fact', source: 'S02:C02:inventory', subject: 'FBA库存', topic_or_metric: key, value, unit: 'units', as_of: inventory.observed_at || null, evidence_refs: refs });
    }
  }

  const c03 = context.C03_current_goals || {};
  const plan = c03.plan || c03.current_plan || c03;
  const primaryGoal = plan.primary_goal ?? plan.primary ?? plan.goal ?? null;
  if (primaryGoal) pushDerived(out, { element_type: 'analysis', source: 'S02:C03', subject: '当前经营目标', topic_or_metric: 'primary_goal', value: primaryGoal, goal: text(primaryGoal), evidence_refs: refs });
  for (const constraint of [...arr(plan.constraints), ...arr(c03.constraints)]) {
    pushDerived(out, { element_type: 'constraint', source: 'S02:C03', subject: '经营约束', value: constraint, evidence_refs: refs });
  }
  for (const goal of arr(c03.goals)) {
    pushDerived(out, { element_type: 'analysis', source: 'S02:C03', subject: '经营目标', topic_or_metric: goal.metric_key || goal.goal_type || null, value: goal.target_value ?? goal.goal ?? goal.name ?? goal, goal: text(goal.goal ?? goal.name ?? goal), status: goal.status ?? null, evidence_refs: refs });
  }

  const c04 = context.C04_core_metrics || {};
  for (const row of arr(c04.observations)) {
    if (row.metric_value === null || row.metric_value === undefined) continue;
    pushDerived(out, { element_type: 'fact', source: `S02:C04:${row.source || 'metric'}`, subject: row.metric_key || 'metric', topic_or_metric: row.metric_key || null, value: row.metric_value, unit: row.unit || null, time_window: row.business_date || null, as_of: row.computed_at || row.business_date || null, evidence_refs: refs });
  }
  for (const key of ['inventory_days_of_cover', 'profit_pressure', 'price', 'sessions', 'conversion_rate']) {
    if (c04[key] !== null && c04[key] !== undefined) pushDerived(out, { element_type: 'fact', source: 'S02:C04', subject: key, topic_or_metric: key, value: c04[key], evidence_refs: refs });
  }

  const c05 = context.C05_events_and_promotions || {};
  for (const event of arr(c05.recent_events)) {
    pushDerived(out, { element_type: 'fact', source: `S02:C05:${event.source || 'event'}`, subject: event.event_type || 'event', topic_or_metric: event.event_type || null, value: event.evidence ?? event.payload ?? event.event_status ?? 'recorded', status: event.event_status ?? null, as_of: event.occurred_at || null, evidence_refs: refs });
  }

  const c07 = context.C07_agent_analyses;
  for (const item of arr(c07)) {
    if (item === null || item === undefined) continue;
    if (typeof item === 'string') {
      const sourceAgent = inferredAgent(item);
      pushDerived(out, { element_type: 'analysis', source: sourceAgent || 'S02:C07', source_agent: sourceAgent, subject: '专业Agent分析', value: item, action_direction: normalizeDirection(item), evidence_refs: refs });
    } else {
      pushDerived(out, { element_type: item.element_type || item.type || 'analysis', source: item.source || item.agent || 'S02:C07', source_agent: item.source_agent || item.agent || null, subject: item.subject || item.topic || '专业Agent分析', topic_or_metric: item.topic_or_metric || item.metric || null, value: item.value ?? item.analysis ?? item.conclusion ?? item, goal: item.goal ?? null, action_direction: item.action_direction || item.recommendation || item.action || null, status: item.status ?? null, as_of: item.as_of ?? item.generated_at ?? null, evidence_refs: item.evidence_refs || refs });
    }
  }

  const c10 = context.C10_active_tasks_and_constraints || {};
  for (const task of arr(c10.active_tasks)) {
    pushDerived(out, { element_type: 'task', source: task.source || 'S02:C10:task', subject: task.subject || task.task_type || task.task_name || task.title || '当前任务', topic_or_metric: task.metric_key || null, value: task.payload ?? task.description ?? task.task_type ?? task.task_id, action_direction: task.action_direction || task.action || task.payload?.action_direction || null, status: task.task_status || task.status || null, as_of: task.updated_at || null, evidence_refs: refs });
  }
  for (const decision of arr(c10.recent_decisions)) {
    pushDerived(out, { element_type: 'decision', source: decision.source || 'S02:C10:decision', subject: decision.subject || decision.decision_type || '历史决策', value: decision.decision ?? decision.payload ?? decision.decision_id, action_direction: decision.action_direction || decision.action || null, status: decision.status || null, as_of: decision.decided_at || null, evidence_refs: refs });
  }
  for (const action of arr(c10.active_plan_actions_and_constraints)) {
    pushDerived(out, { element_type: action.element_type || 'task', source: 'S02:C10:plan_action', subject: action.subject || action.action_type || action.name || '计划动作', value: action.action ?? action.description ?? action.action_type ?? action, action_direction: action.action_direction || action.direction || action.action || null, status: action.status || null, as_of: action.updated_at || null, evidence_refs: refs });
    for (const constraint of arr(action.constraints)) pushDerived(out, { element_type: 'constraint', source: 'S02:C10:plan_constraint', subject: '计划约束', value: constraint, evidence_refs: refs });
  }
  for (const constraint of [...arr(c10.hard_constraints), ...arr(c10.constraints)]) {
    pushDerived(out, { element_type: 'constraint', source: 'S02:C10', subject: '硬约束', value: constraint, evidence_refs: refs });
  }
  return out;
}

export function normalizeConflictElements(input = {}) {
  const context = input.context_package && typeof input.context_package === 'object' ? input.context_package : {};
  const derived = deriveFromContext(context, input.context_refs || []);
  const provided = arr(input.normalized_elements).map((x, i) => normalizeElement(x, `P${String(i + 1).padStart(3, '0')}`));
  const seen = new Set();
  const merged = [];
  for (const element of [...provided, ...derived]) {
    const key = [element.element_type, lower(element.source), lower(element.subject), lower(element.topic_or_metric), text(stableValue(element.value)), lower(element.unit), text(element.time_window), normalizeDirection(element.action_direction)].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(element);
  }
  return merged;
}

function conflictBase({ type, subject, parties, disputed, root, evidence, severity, impact, nextStep, sharedFacts = [], resolutionStatus = 'unresolved', resolutionEvidence = [] }) {
  return {
    conflict_id: null,
    conflict_group_id: null,
    type: CONFLICT_TYPES.has(type) ? type : 'interpretation',
    involved_agents: unique(parties.map((p) => p.source_agent)),
    parties: parties.map((p) => ({ element_id: p.element_id, source: p.source, source_agent: p.source_agent ?? null, value: p.value, unit: p.unit ?? null, as_of: p.as_of ?? null, action_direction: p.action_direction ?? null, status: p.status ?? null })),
    subject: subject || null,
    shared_facts: unique(sharedFacts),
    disputed_points: unique(arr(disputed)),
    root_conflict: root || null,
    evidence_needed: unique(arr(evidence)),
    severity,
    decision_impact: impact,
    resolution_status: resolutionStatus,
    recommended_next_step: nextStep || null,
    resolution_evidence: unique(arr(resolutionEvidence)),
  };
}

function factKey(element) {
  return [lower(element.subject), lower(element.topic_or_metric), text(element.time_window ?? '')].join('|');
}

function numericConflict(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return stableValue(a) !== stableValue(b);
  const tolerance = Math.max(1e-9, Math.max(Math.abs(x), Math.abs(y)) * 0.005);
  return Math.abs(x - y) > tolerance;
}

function detectFactConflicts(elements) {
  const facts = elements.filter((e) => e.element_type === 'fact' && e.value !== null && e.value !== undefined);
  const groups = new Map();
  for (const fact of facts) {
    const key = factKey(fact);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(fact);
  }
  const conflicts = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        if (a.source === b.source && a.as_of === b.as_of) continue;
        const unitA = lower(a.unit);
        const unitB = lower(b.unit);
        if (unitA && unitB && unitA !== unitB) {
          conflicts.push(conflictBase({
            type: 'fact', subject: a.topic_or_metric || a.subject, parties: [a, b],
            disputed: `同一指标单位不可直接比较：${a.unit} vs ${b.unit}`,
            root: `${a.topic_or_metric || a.subject} 口径/单位未统一`,
            evidence: [`确认 ${a.topic_or_metric || a.subject} 的统一单位或换算关系`],
            severity: 'medium', impact: 'confidence_only', nextStep: '先统一单位/口径再比较数值',
          }));
          continue;
        }
        if (!numericConflict(a.value, b.value)) continue;
        const criticalMetric = INVENTORY_RE.test(`${a.subject} ${a.topic_or_metric}`) || /listing|availability|可售|状态/i.test(`${a.subject} ${a.topic_or_metric}`);
        conflicts.push(conflictBase({
          type: 'fact', subject: a.topic_or_metric || a.subject, parties: [a, b],
          disputed: `${a.source}=${text(a.value)} 与 ${b.source}=${text(b.value)} 不一致`,
          root: `${a.topic_or_metric || a.subject} 核心事实不一致`,
          evidence: [`刷新并确认 ${a.topic_or_metric || a.subject} 的权威来源、口径、时间窗口和as_of`],
          severity: criticalMetric ? 'high' : 'medium',
          impact: criticalMetric ? 'blocks_decision' : 'confidence_only',
          nextStep: '优先取得决定性权威事实，不平均冲突数值',
        }));
      }
    }
  }
  return conflicts;
}

function detectInterpretationConflicts(elements) {
  const candidates = elements.filter((e) => ['analysis', 'hypothesis'].includes(e.element_type));
  const groups = new Map();
  for (const e of candidates) {
    const key = [lower(e.subject), lower(e.topic_or_metric)].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const conflicts = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const distinct = unique(group.map((e) => text(e.value || e.goal || e.action_direction)));
    if (distinct.length < 2) continue;
    conflicts.push(conflictBase({
      type: 'interpretation', subject: group[0].topic_or_metric || group[0].subject, parties: group,
      disputed: group.map((e) => `${e.source}: ${text(e.value || e.goal || e.action_direction)}`),
      root: `${group[0].topic_or_metric || group[0].subject} 的原因解释不同`,
      evidence: [`获取能区分这些解释的最小直接证据，优先针对 ${group[0].topic_or_metric || group[0].subject}`],
      severity: 'medium', impact: 'confidence_only', nextStep: '请求决定性证据后再提高结论置信度',
    }));
  }
  return conflicts;
}

function detectStrategyReversal(elements) {
  const active = elements.filter((e) => ['task', 'decision'].includes(e.element_type) && ACTIVE_STATUS_RE.test(text(e.status)) && e.action_direction);
  const proposals = elements.filter((e) => ['recommendation', 'task', 'decision'].includes(e.element_type) && e.action_direction);
  const conflicts = [];
  for (const oldItem of active) {
    for (const nextItem of proposals) {
      if (oldItem.element_id === nextItem.element_id) continue;
      if (!oppositeDirections(oldItem.action_direction, nextItem.action_direction)) continue;
      const subjectOverlap = lower(oldItem.subject) === lower(nextItem.subject) || !oldItem.subject || !nextItem.subject;
      if (!subjectOverlap) continue;
      conflicts.push(conflictBase({
        type: 'strategy', subject: oldItem.subject || nextItem.subject, parties: [oldItem, nextItem],
        disputed: `观察/执行窗口内出现反向动作：${oldItem.action_direction} vs ${nextItem.action_direction}`,
        root: '正在运行的策略 vs 新的反向动作',
        evidence: ['确认当前观察窗口、停止条件、关键新事实和策略变更依据'],
        severity: 'high', impact: 'changes_ranking', nextStep: '交S10判断是否允许提前override当前StrategyChain',
      }));
    }
  }
  return conflicts;
}

function detectGoalAndConstraintConflicts(elements, context) {
  const conflicts = [];
  const contextText = text(context);
  const recommendations = elements.filter((e) => e.element_type === 'recommendation' && GROWTH_DIRECTIONS.has(normalizeDirection(e.action_direction)));
  if (!recommendations.length) return conflicts;
  const constraints = elements.filter((e) => e.element_type === 'constraint');
  const inventoryFacts = elements.filter((e) => e.element_type === 'fact' && INVENTORY_RE.test(`${e.subject} ${e.topic_or_metric}`));
  const profitFacts = elements.filter((e) => ['fact', 'analysis'].includes(e.element_type) && PROFIT_RE.test(`${e.subject} ${e.topic_or_metric} ${text(e.value)}`));
  const hardListing = constraints.filter((e) => HARD_CONSTRAINT_RE.test(`${e.subject} ${text(e.value)}`) && /(listing|不可售|冻结|suppressed|frozen|compliance|禁止)/i.test(`${e.subject} ${text(e.value)}`));

  for (const recommendation of recommendations) {
    if (hardListing.length) {
      conflicts.push(conflictBase({
        type: 'constraint', subject: recommendation.subject || '增长放量', parties: [recommendation, ...hardListing],
        disputed: ['当前存在放量/恢复方向，但Listing/合规硬约束尚未解除'],
        root: '增长动作 vs Listing/合规硬约束',
        evidence: ['确认Listing可售/可投放状态及约束解除证据'],
        severity: 'critical', impact: 'blocks_decision', nextStep: '先解除硬约束并复核，再允许增长动作',
      }));
      continue;
    }

    const lowCoverage = inventoryFacts.filter((e) => {
      const n = Number(e.value);
      return Number.isFinite(n) && /(coverage|days?_of_cover|覆盖)/i.test(`${e.subject} ${e.topic_or_metric}`) && n <= 14;
    });
    const constrainedInventory = constraints.filter((e) => /(断货|库存|stock|inventory)/i.test(`${e.subject} ${text(e.value)}`));
    const profitPressure = profitFacts.filter((e) => /high|pressure|loss|negative|亏损|压力|低于|下降/i.test(text(e.value)) || (Number.isFinite(Number(e.value)) && Number(e.value) < 0));
    const profitConstraints = constraints.filter((e) => /(利润|毛利|profit|margin|预算|budget)/i.test(`${e.subject} ${text(e.value)}`));
    const parties = [recommendation, ...lowCoverage, ...constrainedInventory, ...profitPressure, ...profitConstraints];
    if (parties.length <= 1) continue;
    const approvedTest = APPROVED_TEST_RE.test(contextText);
    conflicts.push(conflictBase({
      type: 'goal', subject: '增长放量', parties,
      sharedFacts: [
        '当前存在扩量方向',
        lowCoverage.length ? `库存覆盖存在低位信号：${lowCoverage.map((e) => text(e.value)).join('/')}` : '',
        profitPressure.length ? '利润存在压力信号' : '',
      ],
      disputed: approvedTest ? ['当前张力是否仍处于已批准测试范围内'] : ['当前是否应继续扩大投入'],
      root: '增长目标 vs 当前资源承受能力',
      evidence: approvedTest
        ? ['确认当前实际消耗是否仍在批准预算和观察窗口内']
        : ['在途补货到仓时间', '当前单位利润与利润底线', '放量后的预计库存消耗'],
      severity: approvedTest ? 'medium' : 'high',
      impact: approvedTest ? 'confidence_only' : 'changes_ranking',
      nextStep: approvedTest ? '保留张力但不机械阻断已批准测试' : '交DecisionItemBuilder形成正式待决事项',
    }));
  }
  return conflicts;
}

function dedupeConflicts(conflicts) {
  const seen = new Set();
  const out = [];
  for (const conflict of conflicts) {
    const key = [conflict.type, lower(conflict.subject), lower(conflict.root_conflict), conflict.decision_impact, ...conflict.parties.map((p) => p.element_id).sort()].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(conflict);
  }
  return out;
}

function assignGroups(conflicts) {
  const rootMap = new Map();
  conflicts.forEach((conflict, index) => { conflict.conflict_id = `CF-${String(index + 1).padStart(3, '0')}`; });
  for (const conflict of conflicts) {
    const root = conflict.root_conflict || `${conflict.type}:${conflict.subject || 'unknown'}`;
    if (!rootMap.has(root)) rootMap.set(root, []);
    rootMap.get(root).push(conflict);
  }
  const groups = [];
  let groupIndex = 0;
  for (const [root, related] of rootMap.entries()) {
    groupIndex += 1;
    const id = `CFG-${String(groupIndex).padStart(3, '0')}`;
    related.forEach((c) => { c.conflict_group_id = id; });
    groups.push({
      conflict_group_id: id,
      root_conflict: root,
      related_conflicts: related.map((c) => c.conflict_id),
      involved_agents: unique(related.flatMap((c) => c.involved_agents)),
      highest_severity: related.reduce((best, c) => SEVERITY_ORDER[c.severity] > SEVERITY_ORDER[best] ? c.severity : best, 'low'),
      highest_decision_impact: related.reduce((best, c) => IMPACT_ORDER[c.decision_impact] > IMPACT_ORDER[best] ? c.decision_impact : best, 'none'),
    });
  }
  return groups;
}

function decideOutcome(conflicts) {
  if (!conflicts.length) return { status: 'clear', next_action: 'continue_to_decision_item_builder' };
  const hasCriticalBlock = conflicts.some((c) => c.severity === 'critical' && ['blocks_decision', 'requires_escalation'].includes(c.decision_impact));
  if (hasCriticalBlock) return { status: 'blocked', next_action: 'hold_for_review' };
  const strategy = conflicts.some((c) => c.type === 'strategy' && c.resolution_status !== 'resolved');
  if (strategy) return { status: 'conflicts_found', next_action: 'send_to_S10' };
  const escalation = conflicts.some((c) => c.decision_impact === 'requires_escalation');
  if (escalation) return { status: 'conflicts_found', next_action: 'request_agent_review' };
  const decisiveEvidence = conflicts.some((c) => ['fact', 'interpretation'].includes(c.type) && c.evidence_needed.length && ['blocks_decision', 'confidence_only'].includes(c.decision_impact));
  if (decisiveEvidence) return { status: 'needs_evidence', next_action: 'request_evidence' };
  return { status: 'conflicts_found', next_action: 'continue_to_decision_item_builder' };
}

export function runS03(input = {}) {
  const generatedAt = (() => {
    const t = Date.parse(input.current_time || '');
    return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
  })();
  const eventId = String(input.event_id || '').trim();
  const scope = input.scope && typeof input.scope === 'object' ? input.scope : null;
  const context = input.context_package && typeof input.context_package === 'object' ? input.context_package : null;

  if (!eventId || !scope?.scope_type || !context) {
    return {
      skill_id: 'S03', event_id: eventId, scope: scope || { scope_type: 'global' }, status: 'blocked',
      conflicts: [], conflict_groups: [], unresolved_points: ['S03缺少event_id、scope或context_package。'],
      normalized_elements: [], context_refs: unique(arr(input.context_refs)), next_action: 'hold_for_review',
      runtime_version: S03_RUNTIME_VERSION, generated_at: generatedAt,
    };
  }

  const elements = normalizeConflictElements(input);
  const conflicts = dedupeConflicts([
    ...detectFactConflicts(elements),
    ...detectInterpretationConflicts(elements),
    ...detectStrategyReversal(elements),
    ...detectGoalAndConstraintConflicts(elements, context),
  ]);
  const groups = assignGroups(conflicts);
  const outcome = decideOutcome(conflicts);
  const unresolved = unique(conflicts.filter((c) => c.resolution_status !== 'resolved').flatMap((c) => [
    ...c.disputed_points,
    ...c.evidence_needed,
  ]));

  return {
    skill_id: 'S03',
    event_id: eventId,
    scope,
    status: outcome.status,
    conflicts,
    conflict_groups: groups,
    unresolved_points: unresolved,
    normalized_elements: elements,
    context_refs: unique(arr(input.context_refs)),
    next_action: outcome.next_action,
    runtime_version: S03_RUNTIME_VERSION,
    generated_at: generatedAt,
  };
}
