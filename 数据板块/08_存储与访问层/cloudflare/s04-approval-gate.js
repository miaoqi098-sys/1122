import { S04_TASK_DRAFT_VERSION } from './s04-task-draft.js';

export const S04_APPROVAL_GATE_VERSION = 'S04-approval-gate-v0.1.0';

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function blocked(reason) {
  return {
    status: 'blocked',
    approvalGateEligible: false,
    nextAction: 'hold_for_review',
    approvalRequests: [],
    reasons: [reason],
    contractVersion: S04_APPROVAL_GATE_VERSION,
  };
}

function validateDraft(draft, expectedRank) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return { ok: false, reason: 'invalid_task_draft_shape' };
  }

  const taskDraftId = text(draft.taskDraftId);
  const decisionCandidateId = text(draft.decisionCandidateId);
  const decisionItemId = text(draft.decisionItemId);
  const eventId = text(draft.eventId);
  const builderRunId = text(draft.builderRunId);
  const conflictRunId = text(draft.conflictRunId);
  const priorityRank = Number(draft.priorityRank);

  if (!taskDraftId) return { ok: false, reason: 'missing_task_draft_id' };
  if (!decisionCandidateId) return { ok: false, reason: 'missing_approval_decision_candidate_id' };
  if (!decisionItemId) return { ok: false, reason: 'missing_approval_decision_item_id' };
  if (decisionCandidateId !== `DC:${decisionItemId}`) {
    return { ok: false, reason: 'approval_decision_candidate_identity_mismatch' };
  }
  if (taskDraftId !== `TD:${decisionCandidateId}`) {
    return { ok: false, reason: 'task_draft_identity_mismatch' };
  }
  if (!Number.isInteger(priorityRank) || priorityRank !== expectedRank) {
    return { ok: false, reason: 'invalid_approval_priority_rank' };
  }
  if (!eventId || !builderRunId || !conflictRunId) {
    return { ok: false, reason: 'missing_approval_lineage' };
  }

  if (draft.taskState !== 'draft') return { ok: false, reason: 'task_not_in_draft_state' };
  if (draft.draftOnly !== true) return { ok: false, reason: 'task_draft_only_flag_invalid' };
  if (draft.readOnly !== true) return { ok: false, reason: 'task_draft_not_read_only' };
  if (draft.approvalRequired !== true) return { ok: false, reason: 'task_approval_requirement_invalid' };
  if (draft.executionAuthorized !== false) return { ok: false, reason: 'task_execution_flag_invalid' };
  if (draft.dispatchAuthorized !== false) return { ok: false, reason: 'task_dispatch_flag_invalid' };

  // The intake contract must never accept caller-supplied approval or authorization state.
  if (
    draft.approved === true ||
    text(draft.approvalStatus) ||
    text(draft.approvedBy) ||
    text(draft.approvalId) ||
    draft.permissionGranted === true
  ) {
    return { ok: false, reason: 'caller_supplied_approval_state_forbidden' };
  }

  return {
    ok: true,
    value: {
      taskDraftId,
      decisionCandidateId,
      decisionItemId,
      priorityRank,
      eventId,
      builderRunId,
      conflictRunId,
    },
  };
}

/**
 * Read-only approval gate intake.
 *
 * This step creates approval requests only. It cannot approve, dispatch, execute,
 * mutate external systems, or grant permissions. Any ambiguous or execution-capable
 * input fails the whole batch closed.
 */
export function createS04ApprovalRequests(taskDraftResult) {
  if (
    taskDraftResult?.status !== 'task_drafts_ready' ||
    taskDraftResult?.taskDraftEligible !== true ||
    taskDraftResult?.nextAction !== 'continue_to_approval_gate'
  ) {
    return blocked('task_drafts_not_released');
  }

  if (text(taskDraftResult?.contractVersion) !== S04_TASK_DRAFT_VERSION) {
    return blocked('unsupported_task_draft_version');
  }

  // Upstream containers must not smuggle authorization into this gate.
  if (
    taskDraftResult?.executionAuthorized === true ||
    taskDraftResult?.dispatchAuthorized === true ||
    taskDraftResult?.approved === true ||
    taskDraftResult?.permissionGranted === true
  ) {
    return blocked('upstream_authorization_state_forbidden');
  }

  const drafts = taskDraftResult?.taskDrafts;
  if (!Array.isArray(drafts) || drafts.length === 0) {
    return blocked('missing_task_drafts');
  }

  const taskDraftIds = new Set();
  const decisionItemIds = new Set();
  const normalized = [];

  for (let index = 0; index < drafts.length; index += 1) {
    const result = validateDraft(drafts[index], index + 1);
    if (!result.ok) return blocked(result.reason);

    if (taskDraftIds.has(result.value.taskDraftId)) return blocked('duplicate_task_draft');
    if (decisionItemIds.has(result.value.decisionItemId)) return blocked('duplicate_approval_decision_item');

    taskDraftIds.add(result.value.taskDraftId);
    decisionItemIds.add(result.value.decisionItemId);
    normalized.push(result.value);
  }

  return {
    status: 'approval_pending',
    approvalGateEligible: true,
    nextAction: 'await_human_approval',
    approvalRequests: normalized.map((item) => ({
      approvalRequestId: `AR:${item.taskDraftId}`,
      taskDraftId: item.taskDraftId,
      decisionCandidateId: item.decisionCandidateId,
      decisionItemId: item.decisionItemId,
      priorityRank: item.priorityRank,
      eventId: item.eventId,
      builderRunId: item.builderRunId,
      conflictRunId: item.conflictRunId,
      approvalStatus: 'pending',
      approvalRequired: true,
      humanApprovalRequired: true,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
      permissionGranted: false,
    })),
    reasons: [],
    contractVersion: S04_APPROVAL_GATE_VERSION,
  };
}
