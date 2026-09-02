export const S04_PRIORITY_POLICY_VERSION = 'S04-priority-policy-v0.1.0';

const GOAL_LAYER_RANK = new Map([
  ['safety_sellability', 0],
  ['survival_operations', 1],
  ['business_quality', 2],
  ['growth_expansion', 3],
  ['unknown', 4],
]);

const URGENCY_RANK = new Map([
  ['immediate', 0],
  ['high', 1],
  ['medium', 2],
  ['low', 3],
  ['unknown', 4],
]);

const SEVERITY_RANK = new Map([
  ['P0', 0],
  ['CRITICAL', 0],
  ['P1', 1],
  ['HIGH', 1],
  ['P2', 2],
  ['MEDIUM', 2],
  ['P3', 3],
  ['LOW', 3],
  ['INFO', 4],
]);

const EVIDENCE_RANK = new Map([
  ['high', 0],
  ['medium', 1],
  ['low', 2],
  ['unknown', 3],
]);

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    rankingEligible: false,
    nextAction: 'hold_for_review',
    rankedDecisionItems: [],
    reasons: [reason],
    policyVersion: S04_PRIORITY_POLICY_VERSION,
  };
}

function normalizeCandidate(candidate) {
  if (
    candidate?.status !== 'candidate_ready' ||
    candidate?.rankingEligible !== true ||
    candidate?.nextAction !== 'continue_to_priority_policy'
  ) {
    return { ok: false, reason: 'priority_candidate_not_ready' };
  }

  const decisionItemId = text(candidate?.decisionItemId);
  const signals = candidate?.signals;
  if (!decisionItemId || !signals || typeof signals !== 'object') {
    return { ok: false, reason: 'invalid_priority_candidate_shape' };
  }

  const goalLayer = text(signals.goalLayer);
  const urgency = text(signals.urgency);
  const severity = text(signals.severity).toUpperCase();
  const evidenceStrength = text(signals.evidenceStrength);
  const dependencyCount = Number(signals.dependencyCount);
  const createdAtMs = Number(signals.createdAtMs);

  if (!GOAL_LAYER_RANK.has(goalLayer)) return { ok: false, reason: 'unsupported_priority_goal_layer' };
  if (!URGENCY_RANK.has(urgency)) return { ok: false, reason: 'unsupported_priority_urgency' };
  if (!SEVERITY_RANK.has(severity)) return { ok: false, reason: 'unsupported_priority_severity' };
  if (!EVIDENCE_RANK.has(evidenceStrength)) return { ok: false, reason: 'unsupported_priority_evidence_strength' };
  if (!Number.isInteger(dependencyCount) || dependencyCount < 0) {
    return { ok: false, reason: 'invalid_priority_dependency_count' };
  }
  if (!Number.isFinite(createdAtMs)) return { ok: false, reason: 'invalid_priority_created_at' };

  return {
    ok: true,
    value: {
      decisionItemId,
      eventId: text(candidate?.eventId),
      builderRunId: text(candidate?.builderRunId),
      conflictRunId: text(candidate?.conflictRunId),
      signals: {
        goalLayer,
        urgency,
        severity,
        evidenceStrength,
        dependencyCount,
        createdAtMs,
      },
      priorityKey: [
        GOAL_LAYER_RANK.get(goalLayer),
        URGENCY_RANK.get(urgency),
        SEVERITY_RANK.get(severity),
        dependencyCount === 0 ? 0 : 1,
        dependencyCount,
        EVIDENCE_RANK.get(evidenceStrength),
        createdAtMs,
        decisionItemId,
      ],
    },
  };
}

function comparePriority(a, b) {
  const length = Math.max(a.priorityKey.length, b.priorityKey.length);
  for (let i = 0; i < length; i += 1) {
    const av = a.priorityKey[i];
    const bv = b.priorityKey[i];
    if (av === bv) continue;
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv));
  }
  return 0;
}

/**
 * Deterministic, read-only S04 ranking policy.
 *
 * Contract:
 * - Accepts only validated S04 priority candidates.
 * - Any malformed/unsupported candidate fails the entire batch closed.
 * - Produces an ordered view only; no task, approval, database, or Amazon write occurs.
 * - Tie breaking is deterministic and ends with decision_item_id.
 */
export function rankS04PriorityCandidates(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return blocked('missing_priority_candidates');
  }

  const normalized = [];
  const ids = new Set();
  for (const candidate of candidates) {
    const result = normalizeCandidate(candidate);
    if (!result.ok) return blocked(result.reason);
    if (ids.has(result.value.decisionItemId)) return blocked('duplicate_priority_candidate');
    ids.add(result.value.decisionItemId);
    normalized.push(result.value);
  }

  normalized.sort(comparePriority);

  return {
    status: 'ranking_ready',
    rankingEligible: true,
    nextAction: 'continue_to_decision_formation',
    rankedDecisionItems: normalized.map((item, index) => ({
      rank: index + 1,
      decisionItemId: item.decisionItemId,
      eventId: item.eventId,
      builderRunId: item.builderRunId,
      conflictRunId: item.conflictRunId,
      signals: item.signals,
    })),
    reasons: [],
    policyVersion: S04_PRIORITY_POLICY_VERSION,
  };
}
