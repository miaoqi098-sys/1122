import assert from 'node:assert/strict';
import { runS04Runtime } from '../s04-runtime.js';
import { buildS04PriorityCandidate } from '../s04-priority.js';
import { rankS04PriorityCandidates } from '../s04-priority-policy.js';
import { formS04DecisionCandidates } from '../s04-decision-formation.js';
import { generateS04TaskDrafts } from '../s04-task-draft.js';
import { createS04ApprovalRequests } from '../s04-approval-gate.js';
import { createS04PermissionDecisions, S04_HUMAN_APPROVAL_VERIFICATION_VERSION } from '../s04-permission-decision.js';
import { createS04DispatchCandidates } from '../s04-dispatch-gate.js';
import { createS04DispatchEnvelopes } from '../s04-dispatch-envelope.js';
import { createS04ExecutionResultContracts } from '../s04-execution-result.js';
import { verifyS04ExecutionResults } from '../s04-execution-result-verification.js';
import { buildS04AuditEnvelopes } from '../s04-audit-envelope.js';
import { validateS04StateMachine } from '../s04-state-machine-validation.js';

const decisionItem = {
  decision_item_id: 'DI:EVT-E2E:01', source_event_refs: ['EVT-E2E'], item_type: 'problem',
  subject: 'Read-only E2E validation', problem_definition: 'Validate the A1/S04 closed loop without production writes.',
  objective: 'Prove lineage and fail-closed authorization boundaries end to end.', goal_layer: 'business_quality',
  severity: 'P2', urgency: 'medium', dependency_count: 0, blocked_items: [], conflict_refs: [], constraint_refs: [],
  evidence_refs: ['EVT-E2E'], context_refs: [], evidence_strength: 'medium', created_at: '2026-09-03T00:00:00.000Z',
};
const row = {
  decision_item_id: decisionItem.decision_item_id, builder_run_id: 'BR-E2E', conflict_run_id: 'CR-E2E', builder_conflict_run_id: 'CR-E2E',
  event_id: 'EVT-E2E', builder_event_id: 'EVT-E2E', conflict_event_id: 'EVT-E2E', builder_context_run_id: 'CTX-E2E', conflict_context_run_id: 'CTX-E2E',
  builder_intake_id: 'INTAKE-E2E', conflict_intake_id: 'INTAKE-E2E', decision_product_id: 'PROD-E2E', builder_product_id: 'PROD-E2E', conflict_product_id: 'PROD-E2E',
  decision_marketplace: 'US', builder_marketplace: 'US', conflict_marketplace: 'US',
  builder_input_json: JSON.stringify({ scope: { scope_type: 'product', scope_id: 'PROD-E2E', product_id: 'PROD-E2E' } }),
  builder_next_action: 'continue_to_S04', s03_next_action: 'continue_to_decision_item_builder', decision_item_json: JSON.stringify(decisionItem),
};
const db = { prepare() { return { bind() { return { async first() { return row; } }; } }; } };

const runtime = await runS04Runtime({ CORE_DB: db }, { decision_item_id: decisionItem.decision_item_id });
const priority = buildS04PriorityCandidate(runtime);
const ranked = rankS04PriorityCandidates([priority]);
const formed = formS04DecisionCandidates(ranked);
const drafts = generateS04TaskDrafts(formed);
const approval = createS04ApprovalRequests(drafts);
const ar = approval.approvalRequests[0];
const humanRecord = {
  approvalRecordId: `AP:${ar.approvalRequestId}`, approvalRequestId: ar.approvalRequestId, taskDraftId: ar.taskDraftId,
  decisionItemId: ar.decisionItemId, reviewerId: 'human-reviewer-e2e', decision: 'approved', decidedAt: '2026-09-03T00:01:00.000Z',
  verificationStatus: 'verified', verificationSource: 'trusted_human_approval_adapter', verificationVersion: S04_HUMAN_APPROVAL_VERIFICATION_VERSION,
  dispatchAuthorized: false, executionAuthorized: false,
};
const permission = createS04PermissionDecisions(approval, [humanRecord]);
const dispatch = createS04DispatchCandidates(permission);
const envelope = createS04DispatchEnvelopes(dispatch);
const intake = createS04ExecutionResultContracts(envelope);
const er = intake.executionResultContracts[0];
const attestation = {
  attestationId: 'EA-E2E', executorId: 'executor-readonly-e2e', executionResultContractId: er.executionResultContractId,
  dispatchEnvelopeId: er.dispatchEnvelopeId, decisionItemId: er.decisionItemId, priorityRank: er.priorityRank, eventId: er.eventId,
  builderRunId: er.builderRunId, conflictRunId: er.conflictRunId, trustDomain: 'approved_executor_registry', verificationState: 'verified',
  resultStatus: 'no_change', observedAt: '2026-09-03T00:02:00Z', dispatchAuthorized: false, executionAuthorized: false,
};
const verified = verifyS04ExecutionResults(intake, [attestation]);
const audit = buildS04AuditEnvelopes(verified);
const state = validateS04StateMachine(audit);

for (const stage of [formed, drafts, approval, permission, dispatch, envelope, intake, verified, audit, state]) {
  assert.notEqual(stage.nextAction, 'hold_for_review');
  assert.equal(stage.dispatchAuthorized ?? false, false);
  assert.equal(stage.executionAuthorized ?? false, false);
}
assert.equal(state.status, 'state_machine_validated');
assert.equal(state.nextAction, 'continue_to_e2e_closed_loop_validation');
assert.equal(state.stateTransitionAuthorized, false);
assert.equal(state.transitionValidations[0].transitionState, 'validated_read_only');
assert.equal(state.transitionValidations[0].proposedState, 'no_change');

const forgedApproval = createS04PermissionDecisions(approval, [{ ...humanRecord, verificationStatus: 'claimed' }]);
assert.equal(forgedApproval.nextAction, 'hold_for_review');
assert.equal(forgedApproval.dispatchAuthorized, false);
assert.equal(forgedApproval.executionAuthorized, false);

console.log(JSON.stringify({ success: true, closedLoop: true, finalAction: state.nextAction, failClosedProbe: forgedApproval.nextAction }, null, 2));
