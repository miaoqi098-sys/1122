import { S04_PRIORITY_POLICY_VERSION } from './s04-priority-policy.js';

export const S04_DECISION_FORMATION_VERSION = 'S04-decision-formation-v0.1.0';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    formationEligible: false,
    nextAction: 'hold_for_review',
    decisionCandidates: [],
    reasons: [reason],
    contractVersion: S04_DECISION_FORMATION_VERSION,
  };
}

function validateRankedItem(item, expectedRank) {
  if (!item || typeof item !== 'object') {
    return { ok: false, reason: 'invalid_ranked_decision_item_shape' };
  }

  const rank = Number(item.rank);
  const decisionItemId = text(item.decisionItemId);
  const eventId = text(item.eventId);
  const builderRunId = text(item.builderRunId);
  const conflictRunId = text(item.conflictRunId);
  const signals = item.signals;

  if (!Number.isInteger(rank) || rank !== expectedRank) {
    return { ok: false, reason: 'invalid_decision_priority_rank' };
  }
  if (!decisionItemId) return { ok: false, reason: 'missing_decision_item_id' };
  if (!eventId) return { ok: false, reason: 'missing_decision_event_id' };
  if (!builderRunId) return { ok: false, reason: 'missing_decision_builder_run_id' };
  if (!conflictRunId) return { ok: false, reason: 'missing_decision_conflict_run_id' };
  if (!signals || typeof signals !== 'object' || Array.isArray(signals)) {
    return { ok: false, reason: 'invalid_decision_priority_signals' };
  }

  const goalLayer = text(signals.goalLayer);
  const urgency = text(signals.urgency);
  const severity = text(signals.severity);
  const evidenceStrength = text(signals.evidenceStrength);
  const dependencyCount = Number(signals.dependencyCount);
  const createdAtMs = Number(signals.createdAtMs);

  if (!goalLayer || !urgency || !severity || !evidenceStrength) {
    return { ok: false, reason: 'incomplete_decision_priority_signals' };
  }
  if (!Number.isInteger(dependencyCount) || dependencyCount < 0) {
    return { ok: false, reason: 'invalid_decision_dependency_count' };
  }
  if (!Number.isFinite(createdAtMs)) {
    return { ok: false, reason: 'invalid_decision_created_at' };
  }

  return {
    ok: true,
    value: {
      rank,
      decisionItemId,
      eventId,
      builderRunId,
      conflictRunId,
      signals: {
        goalLayer,
        urgency,
        severity,
        evidenceStrength,
        dependencyCount,
        createdAtMs,
      },
    },
  };
}

/**
 * Read-only Decision Formation contract.
 *
 * Security properties:
 * - Accepts only an explicitly released S04 priority-policy result.
 * - Requires the exact known priority policy version and contiguous deterministic ranks.
 * - Requires complete DecisionItem lineage identifiers before forming any candidate.
 * - Any malformed or duplicate item fails the whole batch closed.
 * - Produces candidate records only. It never authorizes execution, generates executable
 *   tasks, writes to a database, or performs Amazon mutations.
 */
export function formS04DecisionCandidates(priorityResult) {
  if (
    priorityResult?.status !== 'ranking_ready' ||
    priorityResult?.rankingEligible !== true ||
    priorityResult?.nextAction !== 'continue_to_decision_formation'
  ) {
    return blocked('priority_result_not_released');
  }

  if (text(priorityResult?.policyVersion) !== S04_PRIORITY_POLICY_VERSION) {
    return blocked('unsupported_priority_policy_version');
  }

  const rankedItems = priorityResult?.rankedDecisionItems;
  if (!Array.isArray(rankedItems) || rankedItems.length === 0) {
    return blocked('missing_ranked_decision_items');
  }

  const ids = new Set();
  const normalized = [];
  for (let index = 0; index < rankedItems.length; index += 1) {
    const result = validateRankedItem(rankedItems[index], index + 1);
    if (!result.ok) return blocked(result.reason);
    if (ids.has(result.value.decisionItemId)) return blocked('duplicate_decision_item');
    ids.add(result.value.decisionItemId);
    normalized.push(result.value);
  }

  return {
    status: 'formation_ready',
    formationEligible: true,
    nextAction: 'continue_to_task_draft_generation',
    decisionCandidates: normalized.map((item) => ({
      decisionCandidateId: `DC:${item.decisionItemId}`,
      decisionItemId: item.decisionItemId,
      priorityRank: item.rank,
      eventId: item.eventId,
      builderRunId: item.builderRunId,
      conflictRunId: item.conflictRunId,
      signals: item.signals,
      decisionState: 'candidate',
      readOnly: true,
      executionAuthorized: false,
      taskGenerationMode: 'draft_only',
    })),
    reasons: [],
    contractVersion: S04_DECISION_FORMATION_VERSION,
  };
}
