import { S04_DECISION_FORMATION_VERSION } from './s04-decision-formation.js';

export const S04_TASK_DRAFT_VERSION = 'S04-task-draft-v0.1.0';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    taskDraftEligible: false,
    nextAction: 'hold_for_review',
    taskDrafts: [],
    reasons: [reason],
    contractVersion: S04_TASK_DRAFT_VERSION,
  };
}

function validateSignals(signals) {
  if (!signals || typeof signals !== 'object' || Array.isArray(signals)) {
    return { ok: false, reason: 'invalid_task_draft_signals' };
  }

  const goalLayer = text(signals.goalLayer);
  const urgency = text(signals.urgency);
  const severity = text(signals.severity);
  const evidenceStrength = text(signals.evidenceStrength);
  const dependencyCount = Number(signals.dependencyCount);
  const createdAtMs = Number(signals.createdAtMs);

  if (!goalLayer || !urgency || !severity || !evidenceStrength) {
    return { ok: false, reason: 'incomplete_task_draft_signals' };
  }
  if (!Number.isInteger(dependencyCount) || dependencyCount < 0) {
    return { ok: false, reason: 'invalid_task_draft_dependency_count' };
  }
  if (!Number.isFinite(createdAtMs)) {
    return { ok: false, reason: 'invalid_task_draft_created_at' };
  }

  return {
    ok: true,
    value: {
      goalLayer,
      urgency,
      severity,
      evidenceStrength,
      dependencyCount,
      createdAtMs,
    },
  };
}

function validateCandidate(candidate, expectedRank) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ok: false, reason: 'invalid_decision_candidate_shape' };
  }

  const decisionCandidateId = text(candidate.decisionCandidateId);
  const decisionItemId = text(candidate.decisionItemId);
  const eventId = text(candidate.eventId);
  const builderRunId = text(candidate.builderRunId);
  const conflictRunId = text(candidate.conflictRunId);
  const priorityRank = Number(candidate.priorityRank);

  if (!decisionCandidateId) return { ok: false, reason: 'missing_decision_candidate_id' };
  if (!decisionItemId) return { ok: false, reason: 'missing_task_draft_decision_item_id' };
  if (decisionCandidateId !== `DC:${decisionItemId}`) {
    return { ok: false, reason: 'decision_candidate_identity_mismatch' };
  }
  if (!Number.isInteger(priorityRank) || priorityRank !== expectedRank) {
    return { ok: false, reason: 'invalid_task_draft_priority_rank' };
  }
  if (!eventId) return { ok: false, reason: 'missing_task_draft_event_id' };
  if (!builderRunId) return { ok: false, reason: 'missing_task_draft_builder_run_id' };
  if (!conflictRunId) return { ok: false, reason: 'missing_task_draft_conflict_run_id' };

  if (candidate.decisionState !== 'candidate') {
    return { ok: false, reason: 'decision_candidate_state_not_draftable' };
  }
  if (candidate.readOnly !== true) {
    return { ok: false, reason: 'decision_candidate_not_read_only' };
  }
  if (candidate.executionAuthorized !== false) {
    return { ok: false, reason: 'decision_candidate_execution_flag_invalid' };
  }
  if (candidate.taskGenerationMode !== 'draft_only') {
    return { ok: false, reason: 'decision_candidate_task_mode_invalid' };
  }

  const signalResult = validateSignals(candidate.signals);
  if (!signalResult.ok) return signalResult;

  return {
    ok: true,
    value: {
      decisionCandidateId,
      decisionItemId,
      priorityRank,
      eventId,
      builderRunId,
      conflictRunId,
      signals: signalResult.value,
    },
  };
}

/**
 * Read-only Task Draft Generation contract.
 *
 * Security properties:
 * - Accepts only an explicitly released Decision Formation result.
 * - Requires the exact known Decision Formation contract version.
 * - Re-validates immutable identity, lineage, contiguous rank and non-executable flags.
 * - Any malformed, duplicate or execution-capable candidate fails the whole batch closed.
 * - Produces drafts only. It performs no DB writes, dispatch, approval, external calls or
 *   Amazon mutations and cannot authorize execution.
 */
export function generateS04TaskDrafts(formationResult) {
  if (
    formationResult?.status !== 'formation_ready' ||
    formationResult?.formationEligible !== true ||
    formationResult?.nextAction !== 'continue_to_task_draft_generation'
  ) {
    return blocked('decision_formation_not_released');
  }

  if (text(formationResult?.contractVersion) !== S04_DECISION_FORMATION_VERSION) {
    return blocked('unsupported_decision_formation_version');
  }

  const candidates = formationResult?.decisionCandidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return blocked('missing_decision_candidates');
  }

  const candidateIds = new Set();
  const decisionItemIds = new Set();
  const normalized = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const result = validateCandidate(candidates[index], index + 1);
    if (!result.ok) return blocked(result.reason);

    if (candidateIds.has(result.value.decisionCandidateId)) {
      return blocked('duplicate_decision_candidate');
    }
    if (decisionItemIds.has(result.value.decisionItemId)) {
      return blocked('duplicate_task_draft_decision_item');
    }

    candidateIds.add(result.value.decisionCandidateId);
    decisionItemIds.add(result.value.decisionItemId);
    normalized.push(result.value);
  }

  return {
    status: 'task_drafts_ready',
    taskDraftEligible: true,
    nextAction: 'continue_to_approval_gate',
    taskDrafts: normalized.map((item) => ({
      taskDraftId: `TD:${item.decisionCandidateId}`,
      decisionCandidateId: item.decisionCandidateId,
      decisionItemId: item.decisionItemId,
      priorityRank: item.priorityRank,
      eventId: item.eventId,
      builderRunId: item.builderRunId,
      conflictRunId: item.conflictRunId,
      signals: item.signals,
      taskState: 'draft',
      draftOnly: true,
      readOnly: true,
      executionAuthorized: false,
      approvalRequired: true,
      dispatchAuthorized: false,
    })),
    reasons: [],
    contractVersion: S04_TASK_DRAFT_VERSION,
  };
}
