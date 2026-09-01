export const DECISION_ITEM_BUILDER_RUNTIME_VERSION = 'DecisionItemBuilder-runtime-v1.0.0';

function arr(value) {
  return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
}

function unique(values) {
  return [...new Set(arr(values).flat().filter((v) => v !== null && v !== undefined && String(v).trim()).map(String))];
}

function asText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  try { return JSON.stringify(value); } catch { return String(value); }
}

function eventIdFromRef(ref) {
  const value = String(ref || '').trim();
  if (!value) return '';
  if (value.startsWith('d1:events:')) return value.slice('d1:events:'.length).split(':')[0];
  return value;
}

function selectSourceEvent(contextPackage, sourceEventRefs) {
  const events = arr(contextPackage?.C05_events_and_promotions?.recent_events);
  const wanted = new Set(unique(sourceEventRefs).map(eventIdFromRef));
  return events.find((e) => wanted.has(String(e?.event_id || ''))) || null;
}

function objectiveFromContext(contextPackage = {}) {
  const goalsDomain = contextPackage.C03_current_goals || {};
  const plan = goalsDomain.active_plan || goalsDomain.current_plan || goalsDomain.plan || null;
  const primary = asText(plan?.primary_goal);
  if (primary) return { text: primary, source: 'C03.active_plan.primary_goal' };

  const activeGoals = arr(goalsDomain.goals).filter((g) => !g?.status || String(g.status).toUpperCase() === 'ACTIVE');
  for (const goal of activeGoals) {
    const targetText = asText(goal?.target_text);
    if (targetText) return { text: targetText, source: `C03.goal:${goal.goal_id || goal.metric_key || 'unknown'}` };
    if (goal?.metric_key && goal?.target_value !== null && goal?.target_value !== undefined) {
      const comparator = asText(goal.comparator) || 'target';
      const unit = asText(goal.unit);
      return {
        text: `${goal.metric_key} ${comparator} ${goal.target_value}${unit ? ` ${unit}` : ''}`,
        source: `C03.goal:${goal.goal_id || goal.metric_key}`,
      };
    }
  }

  const stateGoal = asText(contextPackage?.C02_business_state?.current_state?.primary_goal);
  if (stateGoal) return { text: stateGoal, source: 'C02.current_state.primary_goal' };
  return null;
}

function classifyItem(eventType = '', conflicts = []) {
  const t = String(eventType).toUpperCase();
  if (/COMPLIANCE|LISTING|FROZEN|SUPPRESSED|QUALIFICATION|RISK/.test(t)) return 'risk';
  if (/OPPORTUNITY|GROWTH|EXPANSION/.test(t)) return 'opportunity';
  if (/GOAL_GAP|TARGET_GAP/.test(t)) return 'goal_gap';
  if (/DROP|DECLINE|ANOMALY|INVENTORY|STOCK|OUT_OF_STOCK|SESSIONS|TRAFFIC|CONVERSION|PROFIT|MARGIN|PRICE|RATING|REVIEW/.test(t)) return 'problem';
  if (conflicts.length) return 'investigation';
  return 'investigation';
}

function goalLayer(eventType = '', itemType = '') {
  const t = String(eventType).toUpperCase();
  if (/COMPLIANCE|LISTING|FROZEN|SUPPRESSED|QUALIFICATION|SAFETY/.test(t)) return 'safety_sellability';
  if (/INVENTORY|STOCK|OUT_OF_STOCK|COVERAGE|FULFILL/.test(t)) return 'survival_operations';
  if (/OPPORTUNITY|GROWTH|EXPANSION|MARKET/.test(t) || itemType === 'opportunity') return 'growth_expansion';
  if (/SESSIONS|TRAFFIC|CONVERSION|PROFIT|MARGIN|PRICE|RATING|REVIEW|ACOS|TACOS|SALES/.test(t)) return 'business_quality';
  return 'unknown';
}

function urgencyFromSeverity(value) {
  const s = String(value || '').toUpperCase();
  if (['P0', 'CRITICAL'].includes(s)) return 'immediate';
  if (['P1', 'HIGH'].includes(s)) return 'high';
  if (['P2', 'MEDIUM'].includes(s)) return 'medium';
  if (['P3', 'LOW', 'INFO'].includes(s)) return 'low';
  return 'unknown';
}

function evidenceStrength(event = {}) {
  const evidence = event?.evidence || event?.metrics || {};
  const points = Number(evidence?.historyPoints ?? evidence?.history_points ?? 0);
  if (points >= 7) return 'high';
  if (points >= 3) return 'medium';
  if (Object.keys(evidence || {}).length) return 'low';
  return 'unknown';
}

function targetDeviation(event = {}) {
  const evidence = event?.evidence || event?.metrics || {};
  const keys = ['deltaPct', 'delta_pct', 'currentValue', 'current_value', 'baseline7d', 'baseline_7d', 'priorValue', 'prior_value'];
  const out = {};
  for (const key of keys) if (evidence[key] !== undefined) out[key] = evidence[key];
  return Object.keys(out).length ? out : null;
}

function subjectFromContext(contextPackage, event) {
  const product = contextPackage?.C01_product_identity || {};
  const label = asText(product.title) || asText(product.asin) || asText(product.product_id);
  const eventType = asText(event?.event_type) || '经营事项';
  return label ? `${label}｜${eventType}` : eventType;
}

function problemFromEvent(event, conflicts) {
  const type = asText(event?.event_type) || 'UNKNOWN_EVENT';
  const evidence = event?.evidence || event?.payload || null;
  const summary = asText(event?.summary);
  if (summary) return summary;
  if (evidence) return `${type} 已由上游事件和 ContextPackage 记录，证据：${asText(evidence)}`;
  if (conflicts.length) return `${type} 需要处理；S03 同时识别到 ${conflicts.length} 项非阻断冲突。`;
  return `${type} 已进入 A1 正式待决链。`;
}

function stableDecisionItemId(sourceEventRefs, eventType, index = 1) {
  const base = eventIdFromRef(unique(sourceEventRefs)[0]) || String(eventType || 'event').replace(/[^A-Za-z0-9_-]+/g, '-');
  return `DI:${base}:${String(index).padStart(2, '0')}`;
}

export function runDecisionItemBuilder(input = {}) {
  const now = (() => {
    const parsed = Date.parse(input.current_time || '');
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
  })();
  const scope = input.scope && typeof input.scope === 'object' ? input.scope : null;
  const sourceEventRefs = unique(input.source_event_refs);
  const contextPackage = input.context_package && typeof input.context_package === 'object' ? input.context_package : null;
  const contextRefs = unique(input.context_refs);
  const conflicts = arr(input.conflicts);
  const conflictGroups = arr(input.conflict_groups);
  const policy = {
    merge_same_root_problem: input.builder_policy?.merge_same_root_problem !== false,
    allow_multiple_items_per_event: input.builder_policy?.allow_multiple_items_per_event !== false,
    require_objective_from_context: input.builder_policy?.require_objective_from_context !== false,
  };
  const builderId = `DIB:${eventIdFromRef(sourceEventRefs[0]) || 'unknown'}:${DECISION_ITEM_BUILDER_RUNTIME_VERSION}`;

  if (!scope || !scope.scope_type || !sourceEventRefs.length || !contextPackage) {
    return {
      builder_id: builderId,
      decision_items: [],
      merged_source_groups: [],
      builder_notes: ['缺少 scope、source_event_refs 或 context_package，Builder 不得猜测关键业务字段。'],
      next_action: 'hold_for_review',
      runtime_version: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
      generated_at: now,
    };
  }

  // Fail closed: DecisionItemBuilder may only build after an explicit S03 forward route.
  // Missing, unknown or blocked S03 routes must never create an item that can reach S04.
  if (input.s03_next_action !== 'continue_to_decision_item_builder') {
    return {
      builder_id: builderId,
      decision_items: [],
      merged_source_groups: [],
      builder_notes: [`S03 next_action=${input.s03_next_action ?? 'missing'}，不允许进入 DecisionItemBuilder 正常建项。`],
      next_action: 'hold_for_review',
      runtime_version: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
      generated_at: now,
    };
  }

  // Fail closed on provenance mismatch. A DecisionItem must be built from the same event
  // referenced by source_event_refs; never borrow the first unrelated C05 event as evidence.
  const sourceEvent = selectSourceEvent(contextPackage, sourceEventRefs);
  if (!sourceEvent) {
    return {
      builder_id: builderId,
      decision_items: [],
      merged_source_groups: [],
      builder_notes: ['source_event_refs 在 ContextPackage.C05 中没有对应事件；禁止借用其他事件证据进入 S04。'],
      next_action: 'request_more_context',
      runtime_version: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
      generated_at: now,
    };
  }

  const objective = objectiveFromContext(contextPackage);
  if (!objective && policy.require_objective_from_context) {
    return {
      builder_id: builderId,
      decision_items: [],
      merged_source_groups: [],
      builder_notes: ['ContextPackage 中没有可用经营 objective；根据桥接规范，Builder 不自创目标。'],
      next_action: 'request_more_context',
      runtime_version: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
      generated_at: now,
    };
  }

  const eventType = sourceEvent.event_type || input.event_type || 'GENERAL_DECISION_ITEM';
  const itemType = classifyItem(eventType, conflicts);
  const conflictRefs = unique(conflicts.map((c) => c?.conflict_id));
  const constraintRefs = unique([
    ...conflicts.filter((c) => c?.type === 'constraint').map((c) => c?.conflict_id),
    ...contextRefs.filter((r) => /product_operating_plans|product_plan_actions/i.test(r)),
  ]);
  const evidenceRefs = unique([
    ...sourceEventRefs,
    ...contextRefs,
    ...conflicts.flatMap((c) => arr(c?.resolution_evidence)),
  ]);
  const severity = sourceEvent.severity ?? input.severity ?? null;
  const blockedItems = unique(conflicts
    .filter((c) => ['blocks_decision', 'requires_escalation'].includes(c?.decision_impact))
    .map((c) => c?.conflict_id));
  const state = contextPackage?.C02_business_state?.current_state || {};
  const plan = contextPackage?.C03_current_goals?.active_plan || {};

  const item = {
    decision_item_id: stableDecisionItemId(sourceEventRefs, eventType, 1),
    item_type: itemType,
    subject: subjectFromContext(contextPackage, sourceEvent),
    problem_definition: problemFromEvent(sourceEvent, conflicts),
    objective: objective?.text || asText(input.fallback_objective),
    goal_layer: goalLayer(eventType, itemType),
    severity,
    urgency: urgencyFromSeverity(severity),
    deadline: sourceEvent.requires_decision_by ?? null,
    state_relevance: asText(plan.stage || state.stage || state.data_quality_status) || null,
    target_deviation: targetDeviation(sourceEvent),
    dependency_count: conflictGroups.length,
    blocked_items: blockedItems,
    opportunity_window: sourceEvent.opportunity_window ?? null,
    reversibility: 'unknown',
    evidence_strength: evidenceStrength(sourceEvent),
    resource_cost: null,
    conflict_refs: conflictRefs,
    constraint_refs: constraintRefs,
    evidence_refs: evidenceRefs,
    source_event_refs: sourceEventRefs,
    context_refs: contextRefs,
    previous_priority: 'none',
    created_at: now,
    objective_source: objective?.source || null,
  };

  return {
    builder_id: builderId,
    decision_items: [item],
    merged_source_groups: [{
      decision_item_id: item.decision_item_id,
      source_event_refs: sourceEventRefs,
      conflict_refs: conflictRefs,
      merge_reason: policy.merge_same_root_problem ? 'single_root_problem_v1' : 'merge_disabled',
    }],
    builder_notes: [
      'V1 使用确定性映射，不复制专业 Agent recommendation 作为 problem_definition。',
      `objective 来源：${objective?.source || 'builder_policy fallback'}`,
      'business_priority 未在 Builder 中生成；排序留给 S04。',
    ],
    next_action: 'continue_to_S04',
    runtime_version: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
    generated_at: now,
  };
}
