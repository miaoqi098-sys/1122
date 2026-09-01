export const S01_VALIDATOR_VERSION = 'S01-runtime-v1.2.0';

const SOURCE_TYPES = new Set(['professional_agent', 'system', 'human', 'external']);
const SCOPE_TYPES = new Set(['product', 'parent_product', 'sku', 'account', 'store', 'global']);
const PRODUCT_SCOPES = new Set(['product', 'parent_product', 'sku']);
const SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const PROFESSIONAL_AGENT_RE = /^Agent-(?:[2-9]|1[0-3])$/;

const CANONICAL_FIELDS = [
  'event_id', 'source_type', 'source_agent', 'source_actor', 'source_ref',
  'event_type', 'scope_type', 'scope_id', 'scope_objects', 'product_id', 'asin',
  'severity', 'occurred_at', 'received_at', 'summary', 'facts', 'metrics',
  'recommendation', 'confidence', 'evidence_refs', 'related_events',
  'parent_event_id', 'requires_decision_by', 'data_window', 'attachments', 'metadata',
];

function issue(code, message, field = null) {
  return { code, message, ...(field ? { field } : {}) };
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizedText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.%_-]/gu, '')
    .trim();
}

function normalizeIso(value) {
  if (!nonEmptyString(value)) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function sourceCandidates(event) {
  return [event?.source_type, event?.source_agent, event?.source_actor, event?.source_ref]
    .filter(nonEmptyString)
    .map((v) => String(v));
}

function scopeIdentity(event) {
  return [event?.scope_type, event?.scope_id, event?.product_id, event?.asin]
    .map((v) => String(v || '').trim())
    .join('|');
}

function findDuplicateCandidates(event, existingEvents) {
  const exact = [];
  const near = [];
  const currentSummary = normalizedText(event?.summary);
  const currentFacts = normalizedText(Array.isArray(event?.facts) ? event.facts.join(' | ') : '');
  const currentScope = scopeIdentity(event);

  for (const candidate of Array.isArray(existingEvents) ? existingEvents : []) {
    if (!candidate || typeof candidate !== 'object') continue;
    const candidateId = String(candidate.event_id || '').trim();
    if (candidateId && candidateId === String(event?.event_id || '').trim()) {
      exact.push(candidateId);
      continue;
    }
    if (String(candidate.event_type || '') !== String(event?.event_type || '')) continue;
    if (scopeIdentity(candidate) !== currentScope) continue;

    const candidateSummary = normalizedText(candidate.summary);
    const candidateFacts = normalizedText(Array.isArray(candidate.facts) ? candidate.facts.join(' | ') : '');
    const sameSummary = currentSummary && candidateSummary && currentSummary === candidateSummary;
    const sameFacts = currentFacts && candidateFacts && currentFacts === candidateFacts;
    if ((sameSummary || sameFacts) && candidateId) near.push(candidateId);
  }

  return [...new Set([...exact, ...near])];
}

function copyCanonicalEvent(event, currentTimeIso) {
  const normalized = {};
  for (const field of CANONICAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(event, field)) normalized[field] = event[field];
  }

  normalized.event_id = String(event.event_id).trim();
  normalized.source_type = event.source_type;
  normalized.source_agent = event.source_agent ?? null;
  normalized.source_actor = event.source_actor ?? null;
  normalized.source_ref = event.source_ref ?? null;
  normalized.scope_id = event.scope_id ?? null;
  normalized.product_id = event.product_id ?? null;
  normalized.asin = event.asin ?? null;
  normalized.scope_objects = Array.isArray(event.scope_objects) ? event.scope_objects : [];
  normalized.occurred_at = normalizeIso(event.occurred_at);
  normalized.received_at = normalizeIso(event.received_at) || currentTimeIso;
  normalized.summary = String(event.summary).trim();
  normalized.facts = event.facts.map((fact) => String(fact).trim()).filter(Boolean);
  normalized.metrics = event.metrics && typeof event.metrics === 'object' && !Array.isArray(event.metrics) ? event.metrics : {};
  normalized.evidence_refs = Array.isArray(event.evidence_refs) ? event.evidence_refs.map(String) : [];
  normalized.related_events = Array.isArray(event.related_events) ? event.related_events.map(String) : [];
  normalized.parent_event_id = event.parent_event_id ?? null;
  normalized.requires_decision_by = event.requires_decision_by ?? null;
  normalized.data_window = event.data_window ?? null;
  normalized.attachments = Array.isArray(event.attachments) ? event.attachments.map(String) : [];
  normalized.metadata = event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata) ? event.metadata : {};
  if (!Object.prototype.hasOwnProperty.call(event, 'recommendation')) delete normalized.recommendation;
  if (!Object.prototype.hasOwnProperty.call(event, 'confidence')) delete normalized.confidence;
  return normalized;
}

export function validateS01(input = {}) {
  const blockingErrors = [];
  const warnings = [];
  const missingInformation = [];
  const event = input?.event;
  const currentTimeIso = normalizeIso(input?.current_time) || new Date().toISOString();

  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    blockingErrors.push(issue('EVENT_MISSING', 'event 必须是对象。', 'event'));
    return {
      skill_id: 'S01', event_id: '', status: 'rejected', blocking_errors: blockingErrors,
      warnings, missing_information: missingInformation,
      duplicate_signal: { is_possible_duplicate: false, matched_event_ids: [] },
      normalized_event: null, next_action: 'discard_event',
      validation_summary: '事件容器不存在或不可解析。', validator_version: S01_VALIDATOR_VERSION,
    };
  }

  const eventId = nonEmptyString(event.event_id) ? event.event_id.trim() : '';
  if (!eventId) blockingErrors.push(issue('EVENT_ID_MISSING', 'event_id 缺失。', 'event_id'));
  if (!nonEmptyString(event.source_type)) blockingErrors.push(issue('SOURCE_MISSING', 'source_type 缺失。', 'source_type'));
  else if (!SOURCE_TYPES.has(event.source_type)) blockingErrors.push(issue('SOURCE_INVALID', 'source_type 不在允许枚举中。', 'source_type'));

  if (event.source_type === 'professional_agent') {
    if (!nonEmptyString(event.source_agent)) {
      blockingErrors.push(issue('SOURCE_MISSING', 'professional_agent 事件必须提供 source_agent。', 'source_agent'));
    } else if (!PROFESSIONAL_AGENT_RE.test(event.source_agent)) {
      blockingErrors.push(issue('SOURCE_INVALID', 'source_agent 必须为 Agent-2 至 Agent-13。', 'source_agent'));
    }
  }

  if (!nonEmptyString(event.scope_type)) blockingErrors.push(issue('SCOPE_TYPE_MISSING', 'scope_type 缺失。', 'scope_type'));
  else if (!SCOPE_TYPES.has(event.scope_type)) blockingErrors.push(issue('SCOPE_UNRESOLVED', 'scope_type 不可识别。', 'scope_type'));

  if (PRODUCT_SCOPES.has(event.scope_type)) {
    if (!nonEmptyString(event.product_id)) {
      missingInformation.push('product_id');
    } else if (Array.isArray(input.known_product_ids) && input.known_product_ids.length > 0 && !input.known_product_ids.includes(event.product_id)) {
      missingInformation.push(`known_product_ids 中不存在 ${event.product_id}`);
    }
  } else if (SCOPE_TYPES.has(event.scope_type)) {
    const hasScopeId = nonEmptyString(event.scope_id);
    const hasScopeObjects = Array.isArray(event.scope_objects) && event.scope_objects.length > 0;
    if (!hasScopeId && !hasScopeObjects && !nonEmptyString(event.summary)) {
      missingInformation.push('scope_id 或 scope_objects');
    }
  }

  if (!nonEmptyString(event.event_type)) blockingErrors.push(issue('EVENT_TYPE_MISSING', 'event_type 缺失。', 'event_type'));
  if (!SEVERITIES.has(event.severity)) blockingErrors.push(issue('EVENT_STRUCTURE_INVALID', 'severity 必须为 P0/P1/P2/P3。', 'severity'));
  const occurredAt = normalizeIso(event.occurred_at);
  if (!occurredAt) blockingErrors.push(issue('TIME_INVALID', 'occurred_at 不是可解析的 ISO 8601 时间。', 'occurred_at'));
  if (!nonEmptyString(event.summary)) blockingErrors.push(issue('EVENT_STRUCTURE_INVALID', 'summary 缺失。', 'summary'));
  else if (event.summary.trim().length < 8) warnings.push(issue('SUMMARY_WEAK', 'summary 过短，可能不足以独立解释事件。', 'summary'));

  if (!Array.isArray(event.facts) || event.facts.length === 0) {
    blockingErrors.push(issue('EVENT_STRUCTURE_INVALID', 'facts 必须是至少包含一条事实的数组。', 'facts'));
  } else {
    const validFacts = event.facts.filter(nonEmptyString);
    if (validFacts.length !== event.facts.length) warnings.push(issue('FACTS_WEAK', 'facts 中存在空值或非字符串条目。', 'facts'));
    const judgmentOnly = validFacts.length > 0 && validFacts.every((fact) => !/[\d%$￥¥]|当前|过去|基线|排名|库存|价格|流量|销量|订单|点击|会话|转化/.test(fact));
    if (judgmentOnly) warnings.push(issue('FACTS_NOT_VERIFIABLE', 'facts 主要由判断性陈述构成，缺少明显可验证事实。', 'facts'));
  }

  if (Array.isArray(input.allowed_sources) && input.allowed_sources.length > 0) {
    const candidates = sourceCandidates(event);
    if (!candidates.some((candidate) => input.allowed_sources.includes(candidate))) {
      blockingErrors.push(issue('SOURCE_INVALID', `来源 ${candidates.join(' / ') || '(empty)'} 不在 allowed_sources 中。`, 'source_type'));
    }
  }

  const matchedEventIds = findDuplicateCandidates(event, input.existing_events);
  if (matchedEventIds.length) warnings.push(issue('POSSIBLE_DUPLICATE', `可能与事件 ${matchedEventIds.join(', ')} 重复或近重复。`));

  let status;
  let nextAction;
  let normalizedEvent = null;

  if (blockingErrors.length) {
    status = 'rejected';
    nextAction = blockingErrors.some((x) => x.code === 'SOURCE_INVALID') ? 'hold_for_review' : 'discard_event';
  } else if (missingInformation.length) {
    status = 'needs_information';
    nextAction = 'request_information';
  } else {
    normalizedEvent = copyCanonicalEvent(event, currentTimeIso);
    status = warnings.length ? 'passed_with_warnings' : 'passed';
    nextAction = 'continue_to_S02';
  }

  return {
    skill_id: 'S01',
    event_id: eventId,
    status,
    blocking_errors: blockingErrors,
    warnings,
    missing_information: missingInformation,
    duplicate_signal: {
      is_possible_duplicate: matchedEventIds.length > 0,
      matched_event_ids: matchedEventIds,
    },
    normalized_event: normalizedEvent,
    next_action: nextAction,
    validation_summary: status === 'passed'
      ? '事件通过 S01 校验，可进入 S02。'
      : status === 'passed_with_warnings'
        ? `事件通过 S01，但有 ${warnings.length} 条非阻断警告。`
        : status === 'needs_information'
          ? `事件需要补充 ${missingInformation.length} 项信息后重跑 S01。`
          : `事件被 S01 阻断，共 ${blockingErrors.length} 个阻断问题。`,
    validator_version: S01_VALIDATOR_VERSION,
  };
}
