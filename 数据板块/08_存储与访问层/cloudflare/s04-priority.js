export const S04_PRIORITY_CONTRACT_VERSION = 'S04-priority-contract-v0.1.0';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function hold(decisionItemId, reason) {
  return {
    status: 'blocked',
    rankingEligible: false,
    nextAction: 'hold_for_review',
    decisionItemId: decisionItemId || '',
    reasons: [reason],
    contractVersion: S04_PRIORITY_CONTRACT_VERSION,
  };
}

/**
 * Build a read-only priority candidate from an already validated S04 runtime result.
 *
 * Security/behavior contract:
 * - Never accepts an arbitrary DecisionItem as ranking authority.
 * - Only an S04 runtime result that is explicitly ready/eligible may proceed.
 * - Produces normalized ranking signals only; no business score or task is emitted yet.
 * - No database or Amazon/listing/price/ads production write occurs here.
 */
export function buildS04PriorityCandidate(runtimeResult = {}) {
  const decisionItemId = text(runtimeResult?.decisionItemId);

  if (
    runtimeResult?.status !== 'ready' ||
    runtimeResult?.eligible !== true ||
    runtimeResult?.nextAction !== 'continue_to_S04'
  ) {
    return hold(decisionItemId, 's04_runtime_not_ready');
  }

  const item = runtimeResult?.decisionItem;
  if (!item || typeof item !== 'object') {
    return hold(decisionItemId, 'missing_validated_decision_item');
  }

  if (!decisionItemId || text(item.decision_item_id) !== decisionItemId) {
    return hold(decisionItemId, 'decision_item_identity_mismatch');
  }

  const createdAt = text(item.created_at);
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return hold(decisionItemId, 'invalid_decision_item_created_at');
  }

  const dependencyCount = item.dependency_count === undefined || item.dependency_count === null
    ? 0
    : Number(item.dependency_count);
  if (!Number.isInteger(dependencyCount) || dependencyCount < 0) {
    return hold(decisionItemId, 'invalid_decision_item_dependency_count');
  }

  const signals = {
    itemType: text(item.item_type),
    goalLayer: text(item.goal_layer),
    severity: text(item.severity).toUpperCase(),
    urgency: text(item.urgency),
    evidenceStrength: text(item.evidence_strength),
    dependencyCount,
    createdAt,
    createdAtMs,
  };

  for (const [key, value] of Object.entries({
    item_type: signals.itemType,
    goal_layer: signals.goalLayer,
    urgency: signals.urgency,
    evidence_strength: signals.evidenceStrength,
  })) {
    if (!value) return hold(decisionItemId, `missing_priority_signal_${key}`);
  }

  return {
    status: 'candidate_ready',
    rankingEligible: true,
    nextAction: 'continue_to_priority_policy',
    decisionItemId,
    eventId: text(runtimeResult?.eventId),
    builderRunId: text(runtimeResult?.builderRunId),
    conflictRunId: text(runtimeResult?.conflictRunId),
    signals,
    reasons: [],
    contractVersion: S04_PRIORITY_CONTRACT_VERSION,
  };
}
