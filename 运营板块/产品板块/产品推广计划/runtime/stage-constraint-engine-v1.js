'use strict';

/**
 * Product Promotion Plan V2 — deterministic Stage and Constraint evaluators.
 *
 * This module is deliberately a pure, read-only decision layer. Collectors and
 * domain adapters are responsible for reading MetricSnapshot, Event,
 * ValidationResult, InventorySnapshot, and other source records, then passing
 * normalized, evidence-backed facts here. Nothing in this module reads storage,
 * changes ProductStage, creates a task, or authorizes an operational action.
 */

const STAGE_ENGINE_V1_VERSION = 'stage-engine.v1';
const CONSTRAINT_ENGINE_V1_VERSION = 'constraint-engine.v1';

const STAGES = Object.freeze([
  'PRE_LAUNCH',
  'LAUNCH',
  'VALIDATION',
  'GROWTH',
  'SCALE',
  'MATURE',
  'REVALIDATION',
  'CLEARANCE',
  'UNKNOWN',
]);

const CONSTRAINTS = Object.freeze([
  'TRAFFIC_CONSTRAINT',
  // These two values are already accepted by ProductPromotionPlan.v2. V1 does
  // not manufacture them, but continues to consume them for compatibility.
  'CTR_CONSTRAINT',
  'CONVERSION_CONSTRAINT',
  'AD_EFFICIENCY_CONSTRAINT',
  'KEYWORD_RANK_CONSTRAINT',
  'PRICE_CONSTRAINT',
  'REVIEW_CONSTRAINT',
  'INVENTORY_CONSTRAINT',
  'PROFIT_CONSTRAINT',
  'LISTING_CONSTRAINT',
  'COMPETITIVE_CONSTRAINT',
  'POLICY_CONSTRAINT',
  'DATA_CONSTRAINT',
  'NO_MAJOR_CONSTRAINT',
  'UNKNOWN',
]);

const DATA_SUFFICIENCY_STATUSES = new Set(['SUFFICIENT', 'PARTIAL', 'INSUFFICIENT', 'UNKNOWN']);
const TRANSITION_RECOMMENDATIONS = new Set(['ADVANCE', 'HOLD', 'REGRESS']);
const SEVERITY_ORDER = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });
const HARD_CONSTRAINT_ORDER = Object.freeze(['POLICY_CONSTRAINT', 'INVENTORY_CONSTRAINT']);

const ALLOWED_STAGE_TRANSITIONS = Object.freeze({
  PRE_LAUNCH: new Set(['LAUNCH', 'CLEARANCE']),
  LAUNCH: new Set(['VALIDATION', 'CLEARANCE']),
  VALIDATION: new Set(['GROWTH', 'REVALIDATION', 'CLEARANCE']),
  GROWTH: new Set(['SCALE', 'VALIDATION', 'CLEARANCE']),
  SCALE: new Set(['MATURE', 'GROWTH', 'CLEARANCE']),
  MATURE: new Set(['REVALIDATION', 'CLEARANCE']),
  REVALIDATION: new Set(['GROWTH', 'MATURE', 'CLEARANCE']),
  CLEARANCE: new Set(),
});

const STAGE_ORDER = Object.freeze({
  PRE_LAUNCH: 0,
  LAUNCH: 1,
  VALIDATION: 2,
  GROWTH: 3,
  SCALE: 4,
  MATURE: 5,
});

const STAGE_WHY = Object.freeze({
  PRE_LAUNCH: 'Launch readiness is not yet fully evidenced as ready.',
  LAUNCH: 'Launch readiness is evidenced, while the product is still building its first validated operating sample.',
  VALIDATION: 'The minimum launch sample is evidenced; conversion and repeatable-traffic validation remains the current lifecycle focus.',
  GROWTH: 'Conversion and repeatable traffic are evidenced, with no listed growth blocker in the normalized facts.',
  SCALE: 'Sustained growth, keyword momentum, economics, inventory buffer, review, and price health are all evidenced for a scale candidate.',
  MATURE: 'The normalized facts explicitly evidence sufficient samples, completed stage goals, stable mature operations, and no policy block.',
  REVALIDATION: 'An evidence-backed structural change requires lifecycle revalidation.',
  CLEARANCE: 'An evidence-backed clearance requirement overrides normal lifecycle progression.',
  UNKNOWN: 'The required lifecycle evidence is unavailable or incomplete; no lifecycle stage is inferred.',
});

const STRATEGY_POSTURE_BY_CONSTRAINT = Object.freeze({
  TRAFFIC_CONSTRAINT: 'DIAGNOSE_TRAFFIC_SOURCES_BEFORE_EXPANSION',
  CTR_CONSTRAINT: 'DIAGNOSE_SERP_CLICK_THROUGH_BLOCKERS',
  CONVERSION_CONSTRAINT: 'FIX_CONVERSION_BLOCKERS_BEFORE_TRAFFIC_EXPANSION',
  AD_EFFICIENCY_CONSTRAINT: 'PROTECT_MARGIN_AND_REVIEW_AD_EFFICIENCY',
  KEYWORD_RANK_CONSTRAINT: 'PROTECT_CORE_KEYWORD_COVERAGE',
  PRICE_CONSTRAINT: 'VERIFY_PRICE_COMPETITIVENESS_AND_GUARDRAILS',
  REVIEW_CONSTRAINT: 'INVESTIGATE_REVIEW_AND_VOC_BEFORE_SCALING',
  INVENTORY_CONSTRAINT: 'HOLD_SCALE',
  PROFIT_CONSTRAINT: 'PROTECT_MARGIN_AND_PAUSE_SCALE',
  LISTING_CONSTRAINT: 'VERIFY_LISTING_HEALTH_BEFORE_TRAFFIC_EXPANSION',
  COMPETITIVE_CONSTRAINT: 'VERIFY_COMPETITIVE_CHANGE_AND_DEFEND_POSITION',
  POLICY_CONSTRAINT: 'HOLD_FOR_POLICY_REVIEW',
  DATA_CONSTRAINT: 'RESOLVE_DATA_QUALITY_BEFORE_ACTION',
  NO_MAJOR_CONSTRAINT: 'KEEP_OBSERVING',
  UNKNOWN: 'RESOLVE_MISSING_OR_CONFLICTING_EVIDENCE_BEFORE_ACTION',
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(nonEmptyString).map((value) => value.trim()))];
}

function validConfidence(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function clampConfidence(value, maximum = 1) {
  if (!validConfidence(value)) return 0;
  return Math.min(value, maximum);
}

function minimumConfidence(items) {
  const values = items.map((item) => item?.confidence).filter(validConfidence);
  return values.length ? Math.min(...values) : 0;
}

function normalizeFact(raw, key) {
  if (!isObject(raw) || !Object.prototype.hasOwnProperty.call(raw, 'value')) {
    return { key, valid: false, missing: key };
  }

  const evidenceRefs = uniqueStrings(raw.evidence_refs);
  if (!validConfidence(raw.confidence) || evidenceRefs.length === 0) {
    return { key, valid: false, missing: key };
  }

  return {
    key,
    valid: true,
    value: raw.value,
    confidence: raw.confidence,
    evidenceRefs,
  };
}

function fact(input, key) {
  return normalizeFact(input?.signals?.[key], key);
}

function isReady(value) {
  return value === true || value === 'READY';
}

function isHealthy(value) {
  return value === true || value === 'HEALTHY';
}

function condition(key, predicate) {
  return { key, predicate };
}

function evaluateRule(input, conditions) {
  const facts = conditions.map(({ key }) => fact(input, key));
  const missingInputs = facts.filter((item) => !item.valid).map((item) => item.key);
  const failedInputs = facts
    .map((item, index) => (item.valid && !conditions[index].predicate(item.value) ? item.key : null))
    .filter(Boolean);

  return {
    matched: missingInputs.length === 0 && failedInputs.length === 0,
    missingInputs,
    failedInputs,
    facts: facts.filter((item) => item.valid),
  };
}

function evaluateAnyRule(input, conditions) {
  const facts = conditions.map(({ key }) => fact(input, key));
  const matchingFacts = facts.filter((item, index) => item.valid && conditions[index].predicate(item.value));
  if (matchingFacts.length > 0) {
    return {
      matched: true,
      missingInputs: [],
      failedInputs: [],
      facts: matchingFacts,
    };
  }

  return {
    matched: false,
    missingInputs: facts.filter((item) => !item.valid).map((item) => item.key),
    failedInputs: facts
      .map((item, index) => (item.valid && !conditions[index].predicate(item.value) ? item.key : null))
      .filter(Boolean),
    facts: facts.filter((item) => item.valid),
  };
}

function evaluatePreLaunchRule(input) {
  const readinessConditions = [
    condition('launch_readiness', isReady),
    condition('listing_health', isReady),
    condition('inventory_ready', (value) => value === true),
    condition('pricing_ready', (value) => value === true),
    condition('policy_block', (value) => value === false),
  ];
  const rule = evaluateRule(input, readinessConditions);
  return {
    ...rule,
    matched: rule.missingInputs.length === 0 && rule.failedInputs.length > 0,
  };
}

const STAGE_RULES = Object.freeze({
  LAUNCH: [
    condition('launch_readiness', isReady),
    condition('listing_health', isReady),
    condition('inventory_ready', (value) => value === true),
    condition('pricing_ready', (value) => value === true),
    condition('policy_block', (value) => value === false),
  ],
  VALIDATION: [
    condition('minimum_sample_reached', (value) => value === true),
    condition('impressions_above_minimum', (value) => value === true),
    condition('clicks_above_minimum', (value) => value === true),
    condition('orders_present', (value) => value === true),
    condition('search_term_sample_available', (value) => value === true),
  ],
  GROWTH: [
    condition('conversion_validated', (value) => value === true),
    condition('repeatable_traffic_found', (value) => value === true),
    condition('listing_major_blocker', (value) => value === false),
    condition('inventory_supports_growth', (value) => value === true),
    condition('policy_block', (value) => value === false),
  ],
  SCALE: [
    condition('sales_growth_sustained', (value) => value === true),
    condition('target_keyword_momentum_positive', (value) => value === true),
    condition('tacos_within_tolerance', (value) => value === true),
    condition('contribution_margin_after_ads_positive', (value) => value === true),
    condition('inventory_buffer_sufficient', (value) => value === true),
    condition('review_health', isHealthy),
    condition('price_health', isHealthy),
    condition('policy_block', (value) => value === false),
  ],
  MATURE: [
    condition('minimum_sample_reached', (value) => value === true),
    condition('stage_goal_completion_confirmed', (value) => value === true),
    condition('mature_operations_stable', (value) => value === true),
    condition('policy_block', (value) => value === false),
  ],
  CLEARANCE: [condition('clearance_required', (value) => value === true)],
});

const REVALIDATION_CONDITIONS = Object.freeze([
  condition('structural_revalidation_required', (value) => value === true),
  condition('validation_revalidation_required', (value) => value === true),
]);

const EXPLICIT_REGRESSION_RULES = Object.freeze({
  GROWTH: {
    stage: 'VALIDATION',
    conditions: [condition('growth_regression_required', (value) => value === true)],
  },
  SCALE: {
    stage: 'GROWTH',
    conditions: [condition('scale_regression_required', (value) => value === true)],
  },
});

function stageRule(input, stage) {
  if (stage === 'PRE_LAUNCH') return evaluatePreLaunchRule(input);
  if (stage === 'REVALIDATION') return evaluateAnyRule(input, REVALIDATION_CONDITIONS);
  return evaluateRule(input, STAGE_RULES[stage]);
}

function normalizeCurrentStageEvidence(input, currentStage) {
  const raw = input?.current_stage_evidence;
  if (!isObject(raw)) return { key: 'current_stage_evidence', valid: false, missing: 'current_stage_evidence' };
  const withStageValue = Object.prototype.hasOwnProperty.call(raw, 'value') ? raw : { ...raw, value: currentStage };
  return normalizeFact(withStageValue, 'current_stage_evidence');
}

function isKnownStage(value) {
  return STAGES.includes(value) && value !== 'UNKNOWN';
}

function candidateForNewAssessment(input) {
  for (const stage of ['CLEARANCE', 'REVALIDATION', 'MATURE', 'SCALE', 'GROWTH', 'VALIDATION', 'LAUNCH', 'PRE_LAUNCH']) {
    const rule = stageRule(input, stage);
    if (rule.matched) return { stage, rule };
  }
  return null;
}

function candidateForCurrentStage(input, currentStage) {
  if (currentStage === 'CLEARANCE') return null;

  const clearance = stageRule(input, 'CLEARANCE');
  if (clearance.matched) return { stage: 'CLEARANCE', rule: clearance };

  const revalidation = stageRule(input, 'REVALIDATION');
  if (revalidation.matched
    && currentStage !== 'REVALIDATION'
    && isAllowedTransition(currentStage, 'REVALIDATION')) {
    return { stage: 'REVALIDATION', rule: revalidation };
  }

  // Regression is only permitted on an explicit, evidence-backed normalized
  // signal. V1 must not infer a rollback from a missing forward-stage signal.
  const explicitRegression = EXPLICIT_REGRESSION_RULES[currentStage];
  if (explicitRegression) {
    const rule = evaluateRule(input, explicitRegression.conditions);
    if (rule.matched) return { stage: explicitRegression.stage, rule };
  }

  const nextStages = {
    PRE_LAUNCH: ['LAUNCH'],
    LAUNCH: ['VALIDATION'],
    VALIDATION: ['GROWTH'],
    GROWTH: ['SCALE'],
    SCALE: ['MATURE'],
    MATURE: [],
    REVALIDATION: ['MATURE', 'GROWTH'],
  }[currentStage] ?? [];

  for (const stage of nextStages) {
    const rule = stageRule(input, stage);
    if (rule.matched) return { stage, rule };
  }

  // A later-stage signal set can be useful evidence, but may not silently skip
  // the documented lifecycle sequence. Return it as a review candidate; the
  // transition gate in evaluateStage will retain the confirmed current stage.
  const broaderCandidate = candidateForNewAssessment(input);
  if (broaderCandidate && STAGE_ORDER[broaderCandidate.stage] > STAGE_ORDER[currentStage]) {
    return broaderCandidate;
  }
  return null;
}

function transitionRecommendation(fromStage, toStage) {
  if (!fromStage || !toStage || fromStage === toStage) return 'HOLD';
  if (toStage === 'CLEARANCE' || toStage === 'REVALIDATION') return 'REGRESS';
  if (fromStage === 'REVALIDATION' && (toStage === 'GROWTH' || toStage === 'MATURE')) return 'ADVANCE';
  if (STAGE_ORDER[toStage] > STAGE_ORDER[fromStage]) return 'ADVANCE';
  return 'REGRESS';
}

function isAllowedTransition(fromStage, toStage) {
  return Boolean(ALLOWED_STAGE_TRANSITIONS[fromStage]?.has(toStage));
}

function evidenceFromFacts(facts) {
  return facts.map((item) => ({
    signal: item.key,
    value: item.value,
    confidence: item.confidence,
    evidence_refs: item.evidenceRefs,
  }));
}

function flattenedEvidenceRefs(evidence) {
  return uniqueStrings(evidence.flatMap((item) => item.evidence_refs));
}

function buildDataSufficiency(status, missingInputs, evidence) {
  return {
    status,
    missing_inputs: uniqueStrings(missingInputs),
    evidence_refs: flattenedEvidenceRefs(evidence),
  };
}

function partialOrInsufficient(validFacts) {
  return validFacts.length > 0 ? 'PARTIAL' : 'INSUFFICIENT';
}

function schemaDate(value) {
  if (!nonEmptyString(value)) return null;
  const date = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1];
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

function confirmedStageSince(input, currentStage, assessedStage) {
  if (!currentStage || currentStage !== assessedStage) return null;
  const raw = input?.current_stage_since ?? input?.stage_since;
  return schemaDate(raw);
}

function attachStageAudit(result, input, previousStage, candidateStage = null) {
  return {
    ...result,
    // This evaluator does not create ProductStage records. It can preserve the
    // confirmed stage timestamp on a hold, but leaves a newly recommended
    // stage timestamp empty for the persistence layer to establish.
    stage_since: confirmedStageSince(input, previousStage, result.current_stage),
    transition_reason: result.why,
    transition: {
      from_stage: previousStage,
      to_stage: result.current_stage,
      candidate_stage: candidateStage,
      recommendation: result.transition_recommendation,
      reason: result.why,
      evidence_refs: result.supporting_evidence,
      confidence: result.confidence,
      authorized: false,
    },
  };
}

/**
 * Evaluate an evidence-backed ProductPromotionPlan lifecycle stage.
 *
 * `listing_age_days` is intentionally not consulted: the business specification
 * states that product age alone must not determine a stage.
 */
function evaluateStage(input = {}) {
  const currentStage = isKnownStage(input.current_stage) ? input.current_stage : null;
  const currentEvidenceFact = currentStage ? normalizeCurrentStageEvidence(input, currentStage) : null;
  const currentStageRule = currentStage ? stageRule(input, currentStage) : null;
  const candidate = currentStage
    ? candidateForCurrentStage(input, currentStage)
    : candidateForNewAssessment(input);

  if (!candidate) {
    if (currentStage) {
      const currentEvidence = currentEvidenceFact?.valid ? evidenceFromFacts([currentEvidenceFact]) : [];
      const ruleEvidence = currentStageRule?.matched ? evidenceFromFacts(currentStageRule.facts) : [];
      const evidence = [...currentEvidence, ...ruleEvidence];
      const currentStageConfirmed = Boolean(currentEvidenceFact?.valid && currentStageRule?.matched);
      const missingInputs = currentStageConfirmed
        ? []
        : uniqueStrings([
          ...(currentEvidenceFact?.valid ? [] : ['current_stage_evidence']),
          ...(currentStageRule?.missingInputs ?? []),
          ...(currentStageRule?.failedInputs ?? []),
        ]);
      const completeFacts = currentStageConfirmed ? [currentEvidenceFact, ...currentStageRule.facts] : [];
      const dataStatus = currentStageConfirmed ? 'SUFFICIENT' : partialOrInsufficient(evidence);
      const confidence = currentStageConfirmed
        ? minimumConfidence(completeFacts)
        : clampConfidence(minimumConfidence([currentEvidenceFact, ...(currentStageRule?.facts ?? [])]), 0.49);
      const why = currentStageConfirmed
        ? STAGE_WHY[currentStage]
        : 'The latest confirmed stage is retained, but the normalized input does not contain sufficient evidence to confirm its current lifecycle conditions or a transition.';
      return attachStageAudit({
        current_stage: currentStage,
        confidence,
        why,
        reason: why,
        evidence,
        supporting_evidence: flattenedEvidenceRefs(evidence),
        missing_evidence: missingInputs,
        data_sufficiency: buildDataSufficiency(dataStatus, missingInputs, evidence),
        transition_recommendation: 'HOLD',
        transition_candidate: null,
        regression_candidate: null,
        assessment_version: STAGE_ENGINE_V1_VERSION,
        read_only: true,
        state_transition_authorized: false,
        execution_authorized: false,
      }, input, currentStage);
    }

    const examined = ['CLEARANCE', 'REVALIDATION', 'MATURE', 'SCALE', 'GROWTH', 'VALIDATION', 'LAUNCH', 'PRE_LAUNCH']
      .map((stage) => stageRule(input, stage));
    const knownFacts = examined.flatMap((rule) => rule.facts);
    const missingInputs = uniqueStrings(examined.flatMap((rule) => rule.missingInputs));
    const evidence = evidenceFromFacts(knownFacts.filter((item, index, array) => array.findIndex((other) => other.key === item.key) === index));
    const why = STAGE_WHY.UNKNOWN;
    return attachStageAudit({
      current_stage: 'UNKNOWN',
      confidence: clampConfidence(minimumConfidence(knownFacts), 0.49),
      why,
      reason: why,
      evidence,
      supporting_evidence: flattenedEvidenceRefs(evidence),
      missing_evidence: missingInputs,
      data_sufficiency: buildDataSufficiency(partialOrInsufficient(knownFacts), missingInputs, evidence),
      transition_recommendation: 'HOLD',
      transition_candidate: null,
      regression_candidate: null,
      assessment_version: STAGE_ENGINE_V1_VERSION,
      read_only: true,
      state_transition_authorized: false,
      execution_authorized: false,
    }, input, null);
  }

  const candidateEvidence = evidenceFromFacts(candidate.rule.facts);
  const candidateConfidence = minimumConfidence(candidate.rule.facts);
  if (!currentStage) {
    const why = STAGE_WHY[candidate.stage];
    return attachStageAudit({
      current_stage: candidate.stage,
      confidence: candidateConfidence,
      why,
      reason: why,
      evidence: candidateEvidence,
      supporting_evidence: flattenedEvidenceRefs(candidateEvidence),
      missing_evidence: [],
      data_sufficiency: buildDataSufficiency('SUFFICIENT', [], candidateEvidence),
      transition_recommendation: 'HOLD',
      transition_candidate: null,
      regression_candidate: null,
      assessment_version: STAGE_ENGINE_V1_VERSION,
      read_only: true,
      state_transition_authorized: false,
      execution_authorized: false,
    }, input, null, candidate.stage);
  }

  const currentEvidence = currentEvidenceFact?.valid ? evidenceFromFacts([currentEvidenceFact]) : [];
  const allEvidence = [...currentEvidence, ...candidateEvidence];
  const missingInputs = currentEvidenceFact?.valid ? [] : ['current_stage_evidence'];

  if (!isAllowedTransition(currentStage, candidate.stage)) {
    const why = `The evidence supports a ${candidate.stage} candidate, but ${currentStage} -> ${candidate.stage} is not an allowed automatic lifecycle transition; retain the confirmed stage and request staged review.`;
    return attachStageAudit({
      current_stage: currentStage,
      confidence: clampConfidence(minimumConfidence([...candidate.rule.facts, currentEvidenceFact]), missingInputs.length ? 0.49 : 1),
      why,
      reason: why,
      evidence: allEvidence,
      supporting_evidence: flattenedEvidenceRefs(allEvidence),
      missing_evidence: missingInputs,
      data_sufficiency: buildDataSufficiency(missingInputs.length ? 'PARTIAL' : 'SUFFICIENT', missingInputs, allEvidence),
      transition_recommendation: 'HOLD',
      transition_candidate: candidate.stage,
      regression_candidate: null,
      assessment_version: STAGE_ENGINE_V1_VERSION,
      read_only: true,
      state_transition_authorized: false,
      execution_authorized: false,
    }, input, currentStage, candidate.stage);
  }

  const recommendation = transitionRecommendation(currentStage, candidate.stage);
  const why = STAGE_WHY[candidate.stage];
  return attachStageAudit({
    current_stage: candidate.stage,
    confidence: clampConfidence(minimumConfidence([...candidate.rule.facts, currentEvidenceFact]), missingInputs.length ? 0.49 : 1),
    why,
    reason: why,
    evidence: allEvidence,
    supporting_evidence: flattenedEvidenceRefs(allEvidence),
    missing_evidence: missingInputs,
    data_sufficiency: buildDataSufficiency(missingInputs.length ? 'PARTIAL' : 'SUFFICIENT', missingInputs, allEvidence),
    transition_recommendation: recommendation,
    transition_candidate: recommendation === 'ADVANCE' ? candidate.stage : null,
    regression_candidate: recommendation === 'REGRESS' ? candidate.stage : null,
    assessment_version: STAGE_ENGINE_V1_VERSION,
    read_only: true,
    state_transition_authorized: false,
    execution_authorized: false,
  }, input, currentStage, candidate.stage);
}

function normalizeDataSufficiency(value) {
  const status = isObject(value) ? value.status : value;
  return typeof status === 'string' && DATA_SUFFICIENCY_STATUSES.has(status) ? status : null;
}

function normalizeConstraintCandidate(raw, index) {
  if (!isObject(raw)) return { valid: false, missing: `constraint_candidates[${index}]` };
  const constraint = raw.constraint ?? raw.type;
  const active = raw.active === true || raw.status === 'ACTIVE';
  if (!active) return { valid: true, active: false };
  const evidenceRefs = uniqueStrings(raw.evidence_refs);
  if (!CONSTRAINTS.includes(constraint) || constraint === 'NO_MAJOR_CONSTRAINT' || constraint === 'UNKNOWN') {
    return { valid: false, missing: `constraint_candidates[${index}].constraint` };
  }
  if (!Object.prototype.hasOwnProperty.call(SEVERITY_ORDER, raw.severity)) {
    return { valid: false, missing: `constraint_candidates[${index}].severity` };
  }
  if (!validConfidence(raw.confidence)) {
    return { valid: false, missing: `constraint_candidates[${index}].confidence` };
  }
  if (evidenceRefs.length === 0) {
    return { valid: false, missing: `constraint_candidates[${index}].evidence_refs` };
  }
  if (!nonEmptyString(raw.why ?? raw.reason)) {
    return { valid: false, missing: `constraint_candidates[${index}].why` };
  }
  return {
    valid: true,
    active: true,
    constraint,
    severity: raw.severity,
    confidence: raw.confidence,
    why: (raw.why ?? raw.reason).trim(),
    evidenceRefs,
    source: raw.source ?? 'constraint_candidate',
  };
}

function eventEvidenceRefs(event) {
  const structuredEvidenceRefs = Array.isArray(event?.evidence)
    ? event.evidence.map((item) => {
      if (typeof item === 'string') return item;
      if (isObject(item)) return item.ref ?? item.evidence_ref ?? item.evidenceRef;
      return null;
    })
    : [];
  return uniqueStrings([
    ...(Array.isArray(event?.evidence_refs) ? event.evidence_refs : []),
    ...(Array.isArray(event?.source_refs) ? event.source_refs : []),
    ...structuredEvidenceRefs,
  ]);
}

function isLowCoverageEvent(event) {
  return isObject(event) && event.event_type === 'LOW_COVERAGE';
}

function inventoryFromAgent7Event(input) {
  const eventContainer = input?.inventory_event;
  const canonicalEvent = eventContainer?.normalizedEvent?.canonicalEvent ?? eventContainer?.canonicalEvent;
  const domainEvent = eventContainer?.inventorySupplyEvent ?? eventContainer;
  const canonicalLowCoverage = isLowCoverageEvent(canonicalEvent) ? canonicalEvent : null;
  const domainLowCoverage = isLowCoverageEvent(domainEvent) ? domainEvent : null;
  if (!canonicalLowCoverage && !domainLowCoverage) return null;

  // Agent-7 returns both a schema-valid domain event and a richer normalized
  // canonical event. Prefer canonical metrics while retaining the formal event
  // as a fallback for coverage, confidence, and evidence references.
  const primary = canonicalLowCoverage ?? domainLowCoverage;
  const canonicalEvidenceRefs = eventEvidenceRefs(canonicalLowCoverage);
  const domainEvidenceRefs = eventEvidenceRefs(domainLowCoverage);
  return {
    coverage_days: canonicalLowCoverage?.metrics?.coverage_days
      ?? canonicalLowCoverage?.inventory_state?.coverage_days
      ?? domainLowCoverage?.metrics?.coverage_days
      ?? domainLowCoverage?.inventory_state?.coverage_days,
    lead_time_days: canonicalLowCoverage?.metrics?.lead_time_days ?? domainLowCoverage?.metrics?.lead_time_days,
    safety_stock_days: canonicalLowCoverage?.metrics?.safety_stock_days ?? domainLowCoverage?.metrics?.safety_stock_days,
    confidence: canonicalLowCoverage?.confidence ?? domainLowCoverage?.confidence,
    evidence_refs: canonicalEvidenceRefs.length > 0 ? canonicalEvidenceRefs : domainEvidenceRefs,
    freshness: 'fresh',
    source: primary.source ?? 'agent_7_low_coverage_event',
  };
}

function normalizeInventoryCandidate(input) {
  const raw = isObject(input?.inventory) ? input.inventory : inventoryFromAgent7Event(input);
  if (!raw) return { present: false };

  const coverageDays = raw.coverage_days ?? raw.sellable_coverage_days;
  const leadTimeDays = raw.lead_time_days ?? raw.replenishment_lead_time_days;
  const safetyStockDays = raw.safety_stock_days;
  const evidenceRefs = uniqueStrings(raw.evidence_refs);
  const missing = [];
  if (!(typeof coverageDays === 'number' && Number.isFinite(coverageDays) && coverageDays >= 0)) missing.push('inventory.coverage_days');
  if (!(typeof leadTimeDays === 'number' && Number.isFinite(leadTimeDays) && leadTimeDays > 0)) missing.push('inventory.lead_time_days');
  if (safetyStockDays !== undefined && !(typeof safetyStockDays === 'number' && Number.isFinite(safetyStockDays) && safetyStockDays >= 0)) missing.push('inventory.safety_stock_days');
  if (raw.freshness !== 'fresh') missing.push('inventory.freshness');
  if (!validConfidence(raw.confidence)) missing.push('inventory.confidence');
  if (evidenceRefs.length === 0) missing.push('inventory.evidence_refs');
  if (missing.length) {
    return {
      present: true,
      valid: false,
      missing,
      evidenceRefs,
      source: raw.source ?? 'inventory_coverage',
    };
  }

  const safetyBuffer = safetyStockDays ?? 0;
  const reviewThresholdDays = leadTimeDays + safetyBuffer;
  if (coverageDays >= reviewThresholdDays) {
    return { present: true, valid: true, active: false, evidenceRefs, confidence: raw.confidence };
  }

  return {
    present: true,
    valid: true,
    active: true,
    constraint: 'INVENTORY_CONSTRAINT',
    severity: coverageDays < leadTimeDays ? 'P0' : 'P1',
    confidence: raw.confidence,
    why: `Sellable inventory coverage (${coverageDays} days) is below the ${reviewThresholdDays}-day replenishment lead-time${safetyBuffer ? ' plus safety-stock' : ''} boundary.`,
    evidenceRefs,
    source: raw.source ?? 'inventory_coverage',
    metrics: {
      coverage_days: coverageDays,
      lead_time_days: leadTimeDays,
      safety_stock_days: safetyBuffer,
      review_threshold_days: reviewThresholdDays,
    },
  };
}

function constraintEvidence(candidate, role) {
  return {
    constraint: candidate.constraint,
    role,
    severity: candidate.severity,
    confidence: candidate.confidence,
    why: candidate.why,
    evidence_refs: candidate.evidenceRefs,
    source: candidate.source,
    ...(candidate.metrics ? { metrics: candidate.metrics } : {}),
  };
}

function sortCandidates(candidates) {
  return [...candidates].sort((left, right) => {
    const severityDelta = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
    if (severityDelta !== 0) return severityDelta;
    const confidenceDelta = right.confidence - left.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;
    return left.constraint.localeCompare(right.constraint);
  });
}

function equalPriority(left, right) {
  return Boolean(left && right)
    && left.severity === right.severity
    && left.confidence === right.confidence
    && left.constraint !== right.constraint;
}

function dataStatusForConstraints(upstreamStatus, missingInputs) {
  if (upstreamStatus === 'INSUFFICIENT' || upstreamStatus === 'UNKNOWN') return 'INSUFFICIENT';
  if (missingInputs.length > 0) return 'PARTIAL';
  return upstreamStatus ?? 'PARTIAL';
}

function guardrailFor(primaryConstraint, dataStatus) {
  if (primaryConstraint === 'POLICY_CONSTRAINT') {
    return {
      effective_scale_posture: 'HOLD_SCALE',
      blocked_strategy_changes: ['SCALE_UP'],
      reason: 'A policy constraint blocks scale recommendations pending policy review.',
    };
  }
  if (primaryConstraint === 'INVENTORY_CONSTRAINT') {
    return {
      effective_scale_posture: 'HOLD_SCALE',
      blocked_strategy_changes: ['SCALE_UP'],
      reason: 'Inventory coverage is below the replenishment boundary, so scale-up remains blocked.',
    };
  }
  if (primaryConstraint === 'DATA_CONSTRAINT' || primaryConstraint === 'UNKNOWN' || dataStatus !== 'SUFFICIENT') {
    return {
      effective_scale_posture: 'HOLD_SCALE',
      blocked_strategy_changes: ['SCALE_UP'],
      reason: 'Incomplete or conflicting evidence must not produce a scale-up recommendation.',
    };
  }
  return {
    effective_scale_posture: 'NO_SCALE_GUARDRAIL_IDENTIFIED',
    blocked_strategy_changes: [],
    reason: 'The diagnostic layer found no V1 hard constraint; the Strategy Engine remains responsible for any scale decision.',
  };
}

function baseConstraintResult({ primaryConstraint, secondaryConstraints, confidence, why, evidence, missingInputs, dataStatus, conflicts = [] }) {
  const strategyGuardrail = guardrailFor(primaryConstraint, dataStatus);
  return {
    primary_constraint: primaryConstraint,
    secondary_constraints: secondaryConstraints,
    confidence,
    why,
    reason: why,
    evidence,
    supporting_evidence: flattenedEvidenceRefs(evidence),
    missing_evidence: uniqueStrings(missingInputs),
    data_sufficiency: buildDataSufficiency(dataStatus, missingInputs, evidence),
    recommended_strategy: STRATEGY_POSTURE_BY_CONSTRAINT[primaryConstraint],
    strategy_guardrail: strategyGuardrail,
    effective_scale_posture: strategyGuardrail.effective_scale_posture,
    conflicts,
    assessment_version: CONSTRAINT_ENGINE_V1_VERSION,
    read_only: true,
    execution_authorized: false,
  };
}

/**
 * Evaluate evidence-backed constraint candidates and expose V1 scale guardrails.
 *
 * Constraint candidates normally come from the Signal/Root Cause layer. The
 * inventory adapter additionally accepts the normalized Agent-7 LOW_COVERAGE
 * event shape, so the hard inventory boundary can be consumed without a second
 * inventory data model.
 */
function evaluateConstraints(input = {}) {
  const upstreamStatus = normalizeDataSufficiency(input.data_sufficiency);
  const missingInputs = [];
  if (!Array.isArray(input.constraint_candidates)) missingInputs.push('constraint_candidates');

  const candidates = [];
  for (const [index, raw] of (Array.isArray(input.constraint_candidates) ? input.constraint_candidates : []).entries()) {
    const candidate = normalizeConstraintCandidate(raw, index);
    if (!candidate.valid) {
      missingInputs.push(candidate.missing);
    } else if (candidate.active) {
      candidates.push(candidate);
    }
  }

  const inventory = normalizeInventoryCandidate(input);
  if (inventory.present && !inventory.valid) missingInputs.push(...inventory.missing);
  if (inventory.valid && inventory.active) candidates.push(inventory);

  const dataStatus = dataStatusForConstraints(upstreamStatus, missingInputs);
  const hardCandidates = HARD_CONSTRAINT_ORDER
    .map((constraint) => candidates.find((candidate) => candidate.constraint === constraint))
    .filter(Boolean);

  if (hardCandidates.length > 0) {
    const primary = hardCandidates[0];
    const secondary = sortCandidates(candidates.filter((candidate) => candidate !== primary));
    const evidence = [
      constraintEvidence(primary, 'primary'),
      ...secondary.map((candidate) => constraintEvidence(candidate, 'secondary')),
    ];
    return baseConstraintResult({
      primaryConstraint: primary.constraint,
      secondaryConstraints: uniqueStrings(secondary.map((candidate) => candidate.constraint)),
      confidence: clampConfidence(primary.confidence, dataStatus === 'SUFFICIENT' ? 1 : 0.49),
      why: primary.why,
      evidence,
      missingInputs,
      dataStatus,
    });
  }

  const ranked = sortCandidates(candidates);
  if (ranked.length > 0 && equalPriority(ranked[0], ranked[1])) {
    const tied = ranked.filter((candidate) => candidate.severity === ranked[0].severity && candidate.confidence === ranked[0].confidence);
    const evidence = tied.map((candidate) => constraintEvidence(candidate, 'conflicting_primary_candidate'));
    const conflicts = tied.map((candidate) => candidate.constraint);
    return baseConstraintResult({
      primaryConstraint: 'UNKNOWN',
      secondaryConstraints: conflicts,
      confidence: 0.4,
      why: 'Multiple evidence-backed constraints have equal priority; V1 does not invent a fixed business priority to break the tie.',
      evidence,
      missingInputs,
      dataStatus,
      conflicts,
    });
  }

  if (ranked.length > 0) {
    const primary = ranked[0];
    const secondary = ranked.slice(1);
    const evidence = [
      constraintEvidence(primary, 'primary'),
      ...secondary.map((candidate) => constraintEvidence(candidate, 'secondary')),
    ];
    return baseConstraintResult({
      primaryConstraint: primary.constraint,
      secondaryConstraints: uniqueStrings(secondary.map((candidate) => candidate.constraint)),
      confidence: clampConfidence(primary.confidence, dataStatus === 'SUFFICIENT' ? 1 : 0.49),
      why: primary.why,
      evidence,
      missingInputs,
      dataStatus,
    });
  }

  const inputEvidenceRefs = uniqueStrings(input.evidence_refs);
  const inventoryEvidenceRefs = inventory.present ? (inventory.evidenceRefs ?? []) : [];
  const healthyEvidenceRefs = uniqueStrings([
    ...inputEvidenceRefs,
    ...(inventory.valid && !inventory.active ? inventory.evidenceRefs : []),
  ]);
  if (upstreamStatus === 'SUFFICIENT' && missingInputs.length === 0 && healthyEvidenceRefs.length > 0) {
    const evidence = [{
      constraint: 'NO_MAJOR_CONSTRAINT',
      role: 'assessment_coverage',
      evidence_refs: healthyEvidenceRefs,
      source: 'sufficient_constraint_assessment',
    }];
    return baseConstraintResult({
      primaryConstraint: 'NO_MAJOR_CONSTRAINT',
      secondaryConstraints: [],
      confidence: 0.8,
      why: 'The upstream assessment is sufficient and contains no active evidence-backed operating constraint.',
      evidence,
      missingInputs,
      dataStatus: 'SUFFICIENT',
    });
  }

  const partialEvidenceRefs = uniqueStrings([...inputEvidenceRefs, ...inventoryEvidenceRefs]);
  if (partialEvidenceRefs.length === 0) missingInputs.push('evidence_refs');
  const insufficientStatus = dataStatusForConstraints(upstreamStatus, missingInputs);
  return baseConstraintResult({
    primaryConstraint: 'UNKNOWN',
    secondaryConstraints: [],
    confidence: 0,
    why: 'Constraint evidence is insufficient; V1 does not infer a primary bottleneck or a scale-up conclusion.',
    evidence: partialEvidenceRefs.length > 0 ? [{
      constraint: 'UNKNOWN',
      role: 'partial_assessment_coverage',
      evidence_refs: partialEvidenceRefs,
      source: inventory.source ?? 'constraint_assessment',
    }] : [],
    missingInputs,
    dataStatus: insufficientStatus,
  });
}

module.exports = {
  STAGE_ENGINE_V1_VERSION,
  CONSTRAINT_ENGINE_V1_VERSION,
  STAGES,
  CONSTRAINTS,
  TRANSITION_RECOMMENDATIONS,
  evaluateStage,
  evaluateConstraints,
  assessStage: evaluateStage,
  assessConstraints: evaluateConstraints,
};
