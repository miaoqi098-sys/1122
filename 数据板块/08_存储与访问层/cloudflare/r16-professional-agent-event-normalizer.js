export const R16_EVENT_NORMALIZER_VERSION = 'R16-event-normalizer-v1.0.0';

const AGENTS = new Set(Array.from({ length: 12 }, (_, index) => `Agent-${index + 2}`));
const SCOPES = new Set(['product', 'parent_product', 'sku', 'account', 'store', 'global']);
const SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3']);
const SEVERITY_MAP = new Map([
  ['critical', 'P0'],
  ['high', 'P1'],
  ['medium', 'P2'],
  ['low', 'P3'],
  ['info', 'P3'],
]);
const CONFIDENCE_MAP = new Map([
  ['low', 0.35],
  ['medium', 0.65],
  ['high', 0.85],
]);
const PRIVILEGE_KEYS = new Set([
  'executionAuthorized',
  'dispatchAuthorized',
  'stateTransitionAuthorized',
  'permissionGranted',
  'finalDecision',
  'final_decision',
  'task',
]);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDateTime(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function failClosed(reasons) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    normalizationVersion: R16_EVENT_NORMALIZER_VERSION,
    canonicalEvent: null,
    handoff: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}

function normalizeSeverity(value) {
  if (SEVERITIES.has(value)) return value;
  if (typeof value === 'string') return SEVERITY_MAP.get(value.toLowerCase()) ?? null;
  return null;
}

function normalizeConfidence(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) {
    return { value, original: null };
  }
  if (typeof value === 'string') {
    const mapped = CONFIDENCE_MAP.get(value.toLowerCase());
    if (mapped !== undefined) return { value: mapped, original: value };
  }
  if (value === undefined || value === null) return { value: null, original: null };
  return { value: null, original: '__invalid__' };
}

function optionalStringArray(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => !nonEmptyString(item))) return null;
  return [...value];
}

export function normalizeProfessionalAgentEvent(input, options = {}) {
  const reasons = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return failClosed(['invalid_normalizer_input']);
  }

  const sourceAgent = input.source_agent;
  const domainSchema = input.domain_schema;
  const domainEventId = input.domain_event_id;
  const domainEvent = input.domain_event;

  if (!AGENTS.has(sourceAgent)) reasons.push('invalid_source_agent');
  if (!nonEmptyString(domainSchema)) reasons.push('missing_domain_schema');
  if (!nonEmptyString(domainEventId)) reasons.push('missing_domain_event_id');
  if (!domainEvent || typeof domainEvent !== 'object' || Array.isArray(domainEvent)) {
    reasons.push('invalid_domain_event');
  }
  if (reasons.length) return failClosed(reasons);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(domainEvent, key)) {
      reasons.push(`privilege_injection_${key}`);
    }
  }
  if (domainEvent.source_type !== undefined && domainEvent.source_type !== 'professional_agent') {
    reasons.push('source_type_injection');
  }
  if (domainEvent.source_agent !== undefined && domainEvent.source_agent !== sourceAgent) {
    reasons.push('source_agent_mismatch');
  }

  const eventType = domainEvent.event_type ?? domainEvent.opportunity_type ?? domainEvent.type;
  const scope = domainEvent.scope && typeof domainEvent.scope === 'object' && !Array.isArray(domainEvent.scope)
    ? domainEvent.scope
    : {};
  const scopeType = scope.scope_type ?? domainEvent.scope_type;
  const scopeId = scope.scope_id ?? domainEvent.scope_id ?? null;
  const productId = scope.product_id ?? domainEvent.product_id ?? null;
  const asin = scope.asin ?? domainEvent.asin ?? null;
  const severity = normalizeSeverity(domainEvent.severity);
  const occurredAt = domainEvent.observed_at
    ?? domainEvent.detected_at
    ?? domainEvent.occurred_at
    ?? domainEvent.generated_at;
  const summary = domainEvent.summary;
  const facts = domainEvent.facts;
  const confidence = normalizeConfidence(domainEvent.confidence);

  if (!nonEmptyString(eventType)) reasons.push('missing_event_type');
  if (!SCOPES.has(scopeType)) reasons.push('invalid_scope_type');
  if (['product', 'parent_product', 'sku'].includes(scopeType) && !nonEmptyString(productId)) {
    reasons.push('missing_product_id_for_product_scope');
  }
  if (!severity) reasons.push('invalid_severity');
  if (!validDateTime(occurredAt)) reasons.push('invalid_occurred_at');
  if (!nonEmptyString(summary)) reasons.push('missing_summary');
  if (!Array.isArray(facts) || facts.length === 0 || facts.some((fact) => !nonEmptyString(fact))) {
    reasons.push('invalid_facts');
  }
  if (confidence.original === '__invalid__') reasons.push('invalid_confidence');

  const evidenceRefs = optionalStringArray(domainEvent.evidence_refs);
  const relatedEvents = optionalStringArray(domainEvent.related_events);
  const attachments = optionalStringArray(domainEvent.attachments);
  if (evidenceRefs === null) reasons.push('invalid_evidence_refs');
  if (relatedEvents === null) reasons.push('invalid_related_events');
  if (attachments === null) reasons.push('invalid_attachments');

  const scopeObjects = domainEvent.scope_objects ?? domainEvent.affected_entities ?? [];
  if (!Array.isArray(scopeObjects) || scopeObjects.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    reasons.push('invalid_scope_objects');
  }

  if (domainEvent.metrics !== undefined && (!domainEvent.metrics || typeof domainEvent.metrics !== 'object' || Array.isArray(domainEvent.metrics))) {
    reasons.push('invalid_metrics');
  }
  if (domainEvent.recommendation !== undefined && domainEvent.recommendation !== null && !nonEmptyString(domainEvent.recommendation)) {
    reasons.push('invalid_recommendation');
  }
  if (domainEvent.parent_event_id !== undefined && domainEvent.parent_event_id !== null && !nonEmptyString(domainEvent.parent_event_id)) {
    reasons.push('invalid_parent_event_id');
  }
  if (reasons.length) return failClosed(reasons);

  const eventId = nonEmptyString(domainEvent.event_id) ? domainEvent.event_id : domainEventId;
  const receivedAt = options.receivedAt ?? null;
  if (receivedAt !== null && !validDateTime(receivedAt)) {
    return failClosed(['invalid_received_at']);
  }

  const metadata = {
    normalizer_version: R16_EVENT_NORMALIZER_VERSION,
    domain_schema: domainSchema,
    domain_event_id: domainEventId,
  };
  if (confidence.original) metadata.original_confidence = confidence.original;
  if (domainEvent.status !== undefined) metadata.domain_status = domainEvent.status;
  if (domainEvent.strategy_chain_id !== undefined) metadata.strategy_chain_id = domainEvent.strategy_chain_id;

  const canonicalEvent = {
    event_id: eventId,
    source_type: 'professional_agent',
    source_agent: sourceAgent,
    source_ref: domainEventId,
    event_type: eventType,
    scope_type: scopeType,
    scope_id: scopeId,
    scope_objects: [...scopeObjects],
    product_id: productId,
    asin,
    severity,
    occurred_at: occurredAt,
    received_at: receivedAt,
    summary,
    facts: [...facts],
    metrics: domainEvent.metrics ?? {},
    recommendation: domainEvent.recommendation ?? null,
    confidence: confidence.value,
    evidence_refs: evidenceRefs ?? [],
    related_events: relatedEvents ?? [],
    parent_event_id: domainEvent.parent_event_id ?? null,
    data_window: domainEvent.data_window ?? null,
    attachments: attachments ?? [],
    metadata,
  };

  const mappedAt = options.mappedAt ?? receivedAt ?? null;
  if (mappedAt !== null && !validDateTime(mappedAt)) {
    return failClosed(['invalid_mapped_at']);
  }

  const normalizationNotes = [];
  if (confidence.original) normalizationNotes.push(`confidence:${confidence.original}->${confidence.value}`);
  if (domainEvent.severity !== severity) normalizationNotes.push(`severity:${domainEvent.severity}->${severity}`);

  return {
    status: 'normalized',
    nextAction: 'continue_to_A1_event_intake',
    reasons: [],
    normalizationVersion: R16_EVENT_NORMALIZER_VERSION,
    canonicalEvent,
    handoff: {
      protocol_version: '1.0',
      source_agent: sourceAgent,
      domain_schema: domainSchema,
      domain_event_id: domainEventId,
      domain_event: domainEvent,
      canonical_event: canonicalEvent,
      normalization_notes: normalizationNotes,
      mapped_at: mappedAt,
      metadata: { normalizer_version: R16_EVENT_NORMALIZER_VERSION },
    },
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
