'use strict';

const assert = require('assert');
const {
  evaluateStage,
  evaluateConstraints,
  STAGES,
  CONSTRAINTS,
} = require('./stage-constraint-engine-v1');

let evidenceSequence = 0;
function fact(value, confidence = 0.9) {
  evidenceSequence += 1;
  return {
    value,
    confidence,
    evidence_refs: [`evidence://stage-constraint/${evidenceSequence}`],
  };
}

function currentStageEvidence(stage, confidence = 0.9) {
  return fact(stage, confidence);
}

function withEvidenceRefs(prefix) {
  evidenceSequence += 1;
  return [`evidence://${prefix}/${evidenceSequence}`];
}

function validationSignals() {
  return {
    minimum_sample_reached: fact(true),
    impressions_above_minimum: fact(true),
    clicks_above_minimum: fact(true),
    orders_present: fact(true),
    search_term_sample_available: fact(true),
  };
}

function growthSignals() {
  return {
    conversion_validated: fact(true),
    repeatable_traffic_found: fact(true),
    listing_major_blocker: fact(false),
    inventory_supports_growth: fact(true),
    policy_block: fact(false),
  };
}

function scaleSignals() {
  return {
    sales_growth_sustained: fact(true),
    target_keyword_momentum_positive: fact(true),
    tacos_within_tolerance: fact(true),
    contribution_margin_after_ads_positive: fact(true),
    inventory_buffer_sufficient: fact(true),
    review_health: fact('HEALTHY'),
    price_health: fact('HEALTHY'),
    policy_block: fact(false),
  };
}

// Stage transitions follow the Product Promotion Plan V2 transition vocabulary.
const preLaunchAssessment = evaluateStage({
  signals: {
    launch_readiness: fact('NOT_READY'),
    listing_health: fact('READY'),
    inventory_ready: fact(true),
    pricing_ready: fact(true),
    policy_block: fact(false),
  },
});
assert.equal(preLaunchAssessment.current_stage, 'PRE_LAUNCH');
assert.equal(preLaunchAssessment.data_sufficiency.status, 'SUFFICIENT');

const preLaunchToLaunch = evaluateStage({
  current_stage: 'PRE_LAUNCH',
  current_stage_evidence: currentStageEvidence('PRE_LAUNCH'),
  signals: {
    launch_readiness: fact('READY'),
    listing_health: fact('READY'),
    inventory_ready: fact(true),
    pricing_ready: fact(true),
    policy_block: fact(false),
  },
});
assert.equal(preLaunchToLaunch.current_stage, 'LAUNCH');
assert.equal(preLaunchToLaunch.transition_recommendation, 'ADVANCE');

const launchToValidation = evaluateStage({
  current_stage: 'LAUNCH',
  current_stage_evidence: currentStageEvidence('LAUNCH'),
  signals: validationSignals(),
});
assert.equal(launchToValidation.current_stage, 'VALIDATION');
assert.equal(launchToValidation.transition_recommendation, 'ADVANCE');

const validationToGrowth = evaluateStage({
  current_stage: 'VALIDATION',
  current_stage_evidence: currentStageEvidence('VALIDATION'),
  signals: growthSignals(),
});
assert.equal(validationToGrowth.current_stage, 'GROWTH');
assert.equal(validationToGrowth.transition_recommendation, 'ADVANCE');

const growthToScale = evaluateStage({
  current_stage: 'GROWTH',
  current_stage_evidence: currentStageEvidence('GROWTH'),
  signals: scaleSignals(),
});
assert.equal(growthToScale.current_stage, 'SCALE');
assert.equal(growthToScale.transition_recommendation, 'ADVANCE');
assert.equal(growthToScale.data_sufficiency.status, 'SUFFICIENT');
assert.ok(growthToScale.evidence.length > 0);
assert.equal(growthToScale.stage_since, null);
assert.deepStrictEqual(growthToScale.transition, {
  from_stage: 'GROWTH',
  to_stage: 'SCALE',
  candidate_stage: 'SCALE',
  recommendation: 'ADVANCE',
  reason: growthToScale.why,
  evidence_refs: growthToScale.supporting_evidence,
  confidence: growthToScale.confidence,
  authorized: false,
});

const scaleToMature = evaluateStage({
  current_stage: 'SCALE',
  current_stage_evidence: currentStageEvidence('SCALE'),
  signals: {
    minimum_sample_reached: fact(true),
    stage_goal_completion_confirmed: fact(true),
    mature_operations_stable: fact(true),
    policy_block: fact(false),
  },
});
assert.equal(scaleToMature.current_stage, 'MATURE');
assert.equal(scaleToMature.transition_recommendation, 'ADVANCE');

// A mature classification cannot be inferred from operational stability alone.
const insufficientMatureEvidence = evaluateStage({
  signals: {
    mature_operations_stable: fact(true),
    policy_block: fact(false),
  },
});
assert.notEqual(insufficientMatureEvidence.current_stage, 'MATURE');
assert.equal(insufficientMatureEvidence.data_sufficiency.status, 'PARTIAL');
assert.ok(insufficientMatureEvidence.confidence < 0.5);

const matureToRevalidation = evaluateStage({
  current_stage: 'MATURE',
  current_stage_evidence: currentStageEvidence('MATURE'),
  signals: { structural_revalidation_required: fact(true) },
});
assert.equal(matureToRevalidation.current_stage, 'REVALIDATION');
assert.equal(matureToRevalidation.transition_recommendation, 'REGRESS');

// The documented rollback paths require an explicit evidence-backed signal;
// absence of an advance signal is never treated as an inferred rollback.
const validationToRevalidation = evaluateStage({
  current_stage: 'VALIDATION',
  current_stage_evidence: currentStageEvidence('VALIDATION'),
  signals: { validation_revalidation_required: fact(true) },
});
assert.equal(validationToRevalidation.current_stage, 'REVALIDATION');
assert.equal(validationToRevalidation.transition_recommendation, 'REGRESS');

const growthToValidation = evaluateStage({
  current_stage: 'GROWTH',
  current_stage_evidence: currentStageEvidence('GROWTH'),
  signals: { growth_regression_required: fact(true) },
});
assert.equal(growthToValidation.current_stage, 'VALIDATION');
assert.equal(growthToValidation.transition_recommendation, 'REGRESS');

const scaleToGrowth = evaluateStage({
  current_stage: 'SCALE',
  current_stage_evidence: currentStageEvidence('SCALE'),
  signals: { scale_regression_required: fact(true) },
});
assert.equal(scaleToGrowth.current_stage, 'GROWTH');
assert.equal(scaleToGrowth.transition_recommendation, 'REGRESS');

// Successful revalidation exits are lifecycle advances, not regressions.
const revalidationToGrowth = evaluateStage({
  current_stage: 'REVALIDATION',
  current_stage_evidence: currentStageEvidence('REVALIDATION'),
  signals: growthSignals(),
});
assert.equal(revalidationToGrowth.current_stage, 'GROWTH');
assert.equal(revalidationToGrowth.transition_recommendation, 'ADVANCE');

const revalidationToMature = evaluateStage({
  current_stage: 'REVALIDATION',
  current_stage_evidence: currentStageEvidence('REVALIDATION'),
  signals: {
    minimum_sample_reached: fact(true),
    stage_goal_completion_confirmed: fact(true),
    mature_operations_stable: fact(true),
    policy_block: fact(false),
  },
});
assert.equal(revalidationToMature.current_stage, 'MATURE');
assert.equal(revalidationToMature.transition_recommendation, 'ADVANCE');

const anyToClearance = evaluateStage({
  current_stage: 'GROWTH',
  current_stage_evidence: currentStageEvidence('GROWTH'),
  signals: { clearance_required: fact(true) },
});
assert.equal(anyToClearance.current_stage, 'CLEARANCE');
assert.equal(anyToClearance.transition_recommendation, 'REGRESS');

// A complete later-stage signal set may not silently skip a required lifecycle transition.
const skippedTransition = evaluateStage({
  current_stage: 'LAUNCH',
  current_stage_evidence: currentStageEvidence('LAUNCH'),
  signals: growthSignals(),
});
assert.equal(skippedTransition.current_stage, 'LAUNCH');
assert.equal(skippedTransition.transition_recommendation, 'HOLD');
assert.equal(skippedTransition.transition_candidate, 'GROWTH');

// Listing age has no influence when the normalized operating evidence is unchanged.
const stageWithoutAge = {
  signals: growthSignals(),
  listing_age_days: 1,
};
const stageWithDifferentAge = {
  ...stageWithoutAge,
  listing_age_days: 365,
};
assert.deepStrictEqual(evaluateStage(stageWithoutAge), evaluateStage(stageWithDifferentAge));
assert.equal(evaluateStage(stageWithoutAge).current_stage, 'GROWTH');

// Sufficient evidence can confirm a stable current stage without inventing a
// transition or downgrading routine operations to partial data.
const confirmedGrowth = evaluateStage({
  current_stage: 'GROWTH',
  current_stage_evidence: currentStageEvidence('GROWTH'),
  signals: growthSignals(),
});
assert.equal(confirmedGrowth.current_stage, 'GROWTH');
assert.equal(confirmedGrowth.transition_recommendation, 'HOLD');
assert.equal(confirmedGrowth.data_sufficiency.status, 'SUFFICIENT');
assert.ok(confirmedGrowth.confidence >= 0.9);
assert.ok(confirmedGrowth.evidence.some((item) => item.signal === 'conversion_validated'));

// Missing evidence never becomes a high-confidence scale conclusion.
const insufficientStage = evaluateStage({
  current_stage: 'GROWTH',
  current_stage_since: '2026-09-01T00:00:00Z',
});
assert.equal(insufficientStage.current_stage, 'GROWTH');
assert.equal(insufficientStage.data_sufficiency.status, 'INSUFFICIENT');
assert.ok(insufficientStage.confidence < 0.5);
assert.equal(insufficientStage.stage_since, '2026-09-01');
assert.equal(insufficientStage.transition.from_stage, 'GROWTH');
assert.equal(insufficientStage.transition.to_stage, 'GROWTH');
assert.equal(insufficientStage.transition_recommendation, 'HOLD');

const unknownInitialStage = evaluateStage({ signals: { launch_readiness: fact('READY') } });
assert.equal(unknownInitialStage.current_stage, 'UNKNOWN');
assert.equal(unknownInitialStage.data_sufficiency.status, 'PARTIAL');
assert.ok(unknownInitialStage.confidence < 0.5);

// The proven GROWTH -> SCALE candidate above is still blocked by the existing
// inventory coverage boundary; diagnosis remains separate from action planning.
const inventoryHardConstraint = evaluateConstraints({
  data_sufficiency: 'SUFFICIENT',
  constraint_candidates: [{
    constraint: 'AD_EFFICIENCY_CONSTRAINT',
    active: true,
    severity: 'P2',
    confidence: 0.9,
    why: 'Advertising performance otherwise supports a scale review.',
    evidence_refs: withEvidenceRefs('ad-efficiency'),
  }],
  inventory: {
    coverage_days: 18,
    lead_time_days: 35,
    safety_stock_days: 0,
    freshness: 'fresh',
    confidence: 0.95,
    evidence_refs: withEvidenceRefs('inventory'),
  },
});
assert.equal(inventoryHardConstraint.primary_constraint, 'INVENTORY_CONSTRAINT');
assert.equal(inventoryHardConstraint.effective_scale_posture, 'HOLD_SCALE');
assert.ok(inventoryHardConstraint.strategy_guardrail.blocked_strategy_changes.includes('SCALE_UP'));
assert.notEqual(inventoryHardConstraint.recommended_strategy, 'SCALE_UP');
assert.ok(inventoryHardConstraint.evidence.some((item) => item.constraint === 'INVENTORY_CONSTRAINT'));

// An Agent-7-shaped normalized LOW_COVERAGE event is accepted without a second
// inventory DTO. Formal Agent-7 events carry evidence objects, not only refs.
const agent7InventoryEvent = evaluateConstraints({
  data_sufficiency: 'SUFFICIENT',
  constraint_candidates: [],
  inventory_event: {
    event_type: 'LOW_COVERAGE',
    confidence: 0.9,
    inventory_state: { coverage_days: 18 },
    metrics: { lead_time_days: 35, safety_stock_days: 0 },
    evidence: [{ ref: withEvidenceRefs('agent-7')[0] }],
    source_refs: ['agent-7://inventory-supply-event'],
  },
});
assert.equal(agent7InventoryEvent.primary_constraint, 'INVENTORY_CONSTRAINT');
assert.equal(agent7InventoryEvent.effective_scale_posture, 'HOLD_SCALE');

// A bare formal Agent-7 event without lead-time metrics remains partial, while
// preserving its supplied evidence instead of fabricating the missing metric.
const incompleteAgent7InventoryEvent = evaluateConstraints({
  data_sufficiency: 'SUFFICIENT',
  constraint_candidates: [],
  inventory_event: {
    event_type: 'LOW_COVERAGE',
    confidence: 0.9,
    inventory_state: { coverage_days: 18 },
    evidence: [{ ref: withEvidenceRefs('agent-7-incomplete')[0] }],
  },
});
assert.equal(incompleteAgent7InventoryEvent.primary_constraint, 'UNKNOWN');
assert.equal(incompleteAgent7InventoryEvent.data_sufficiency.status, 'PARTIAL');
assert.ok(incompleteAgent7InventoryEvent.missing_evidence.includes('inventory.lead_time_days'));
assert.ok(!incompleteAgent7InventoryEvent.missing_evidence.includes('evidence_refs'));
assert.ok(incompleteAgent7InventoryEvent.supporting_evidence.some((ref) => ref.includes('agent-7-incomplete')));

const agent7CanonicalInventoryEvent = evaluateConstraints({
  data_sufficiency: 'SUFFICIENT',
  constraint_candidates: [],
  inventory_event: {
    inventorySupplyEvent: {
      event_type: 'LOW_COVERAGE',
      confidence: 0.8,
      inventory_state: { coverage_days: 18 },
      evidence: [{ ref: withEvidenceRefs('agent-7-domain') }],
    },
    normalizedEvent: {
      canonicalEvent: {
        event_type: 'LOW_COVERAGE',
        confidence: 0.9,
        metrics: { coverage_days: 18, lead_time_days: 35, safety_stock_days: 0 },
        evidence_refs: withEvidenceRefs('agent-7-canonical'),
      },
    },
  },
});
assert.equal(agent7CanonicalInventoryEvent.primary_constraint, 'INVENTORY_CONSTRAINT');
assert.equal(agent7CanonicalInventoryEvent.effective_scale_posture, 'HOLD_SCALE');

// Equal evidence priority remains explainable instead of inventing a global priority rule.
const conflictingConstraints = evaluateConstraints({
  data_sufficiency: 'SUFFICIENT',
  constraint_candidates: [
    {
      constraint: 'TRAFFIC_CONSTRAINT',
      active: true,
      severity: 'P1',
      confidence: 0.8,
      why: 'Sessions are down while the upstream assessment remains comparable.',
      evidence_refs: withEvidenceRefs('traffic'),
    },
    {
      constraint: 'CONVERSION_CONSTRAINT',
      active: true,
      severity: 'P1',
      confidence: 0.8,
      why: 'Conversion is down in the same sufficient observation window.',
      evidence_refs: withEvidenceRefs('conversion'),
    },
  ],
});
assert.equal(conflictingConstraints.primary_constraint, 'UNKNOWN');
assert.deepStrictEqual(conflictingConstraints.conflicts.sort(), ['CONVERSION_CONSTRAINT', 'TRAFFIC_CONSTRAINT']);
assert.equal(conflictingConstraints.effective_scale_posture, 'HOLD_SCALE');

const healthyAssessment = evaluateConstraints({
  data_sufficiency: 'SUFFICIENT',
  constraint_candidates: [],
  inventory: {
    coverage_days: 60,
    lead_time_days: 35,
    safety_stock_days: 5,
    freshness: 'fresh',
    confidence: 0.9,
    evidence_refs: withEvidenceRefs('healthy-inventory'),
  },
});
assert.equal(healthyAssessment.primary_constraint, 'NO_MAJOR_CONSTRAINT');
assert.equal(healthyAssessment.effective_scale_posture, 'NO_SCALE_GUARDRAIL_IDENTIFIED');

// Existing ProductPromotionPlan V2 codes remain consumable by the V1 evaluator.
const existingCtrConstraint = evaluateConstraints({
  data_sufficiency: 'SUFFICIENT',
  constraint_candidates: [{
    constraint: 'CTR_CONSTRAINT',
    active: true,
    severity: 'P2',
    confidence: 0.7,
    why: 'CTR has declined while upstream evidence remains comparable.',
    evidence_refs: withEvidenceRefs('ctr'),
  }],
});
assert.equal(existingCtrConstraint.primary_constraint, 'CTR_CONSTRAINT');

const insufficientConstraints = evaluateConstraints({
  data_sufficiency: 'INSUFFICIENT',
  constraint_candidates: [],
});
assert.equal(insufficientConstraints.primary_constraint, 'UNKNOWN');
assert.equal(insufficientConstraints.data_sufficiency.status, 'INSUFFICIENT');
assert.ok(insufficientConstraints.confidence < 0.5);

assert.ok(STAGES.includes('SCALE'));
assert.ok(CONSTRAINTS.includes('INVENTORY_CONSTRAINT'));
console.log('stage-constraint-engine-v1.test: PASS');
