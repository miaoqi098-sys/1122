import assert from 'node:assert/strict';
import {
  validateS04DecisionItemLineage,
  S04_INGRESS_CONTRACT_VERSION,
} from '../s04-ingress.js';

const validItem = {
  decision_item_id: 'DI:EVT-1:01',
  source_event_refs: ['EVT-1'],
  item_type: 'problem',
  subject: 'Test product｜TRAFFIC_DROP',
  problem_definition: 'Traffic dropped versus baseline.',
  objective: 'Restore qualified traffic while protecting profitability.',
  goal_layer: 'business_quality',
  severity: 'P2',
  urgency: 'medium',
  dependency_count: 0,
  blocked_items: [],
  conflict_refs: [],
  constraint_refs: [],
  evidence_refs: ['EVT-1'],
  context_refs: [],
  evidence_strength: 'medium',
  created_at: '2026-09-02T00:00:00.000Z',
};

const base = {
  decision_item_id: 'DI:EVT-1:01',
  builder_run_id: 'BR-1',
  conflict_run_id: 'CR-1',
  builder_conflict_run_id: 'CR-1',
  event_id: 'EVT-1',
  builder_event_id: 'EVT-1',
  conflict_event_id: 'EVT-1',
  builder_context_run_id: 'CTX-1',
  conflict_context_run_id: 'CTX-1',
  builder_intake_id: 'INTAKE-1',
  conflict_intake_id: 'INTAKE-1',
  decision_product_id: 'PROD-1',
  builder_product_id: 'PROD-1',
  conflict_product_id: 'PROD-1',
  decision_marketplace: 'US',
  builder_marketplace: 'US',
  conflict_marketplace: 'US',
  builder_input_json: JSON.stringify({
    scope: { scope_type: 'product', scope_id: 'PROD-1', product_id: 'PROD-1', asin: 'B000TEST01' },
  }),
  builder_next_action: 'continue_to_S04',
  s03_next_action: 'continue_to_decision_item_builder',
  decision_item_json: JSON.stringify(validItem),
};

const ready = validateS04DecisionItemLineage(base);
assert.equal(ready.contractVersion, S04_INGRESS_CONTRACT_VERSION);
assert.equal(ready.eligible, true);
assert.equal(ready.nextAction, 'continue_to_S04');
assert.deepEqual(ready.reasons, []);

const prefixedSameEvent = validateS04DecisionItemLineage({
  ...base,
  decision_item_json: JSON.stringify({
    ...validItem,
    source_event_refs: ['d1:events:EVT-1:canonical'],
  }),
});
assert.equal(prefixedSameEvent.eligible, true);
assert.equal(prefixedSameEvent.nextAction, 'continue_to_S04');

const storeScope = validateS04DecisionItemLineage({
  ...base,
  decision_product_id: null,
  builder_product_id: null,
  conflict_product_id: null,
  builder_input_json: JSON.stringify({ scope: { scope_type: 'store', scope_id: 'US', product_id: null } }),
});
assert.equal(storeScope.eligible, true);
assert.equal(storeScope.nextAction, 'continue_to_S04');

const globalScope = validateS04DecisionItemLineage({
  ...base,
  decision_product_id: null,
  builder_product_id: null,
  conflict_product_id: null,
  decision_marketplace: null,
  builder_marketplace: null,
  conflict_marketplace: null,
  builder_input_json: JSON.stringify({ scope: { scope_type: 'global', scope_id: '1122', product_id: null } }),
});
assert.equal(globalScope.eligible, true);
assert.equal(globalScope.nextAction, 'continue_to_S04');

const { builder_input_json: omittedBuilderInput, ...rowWithoutBuilderInput } = base;
void omittedBuilderInput;
const missingBuilderInput = validateS04DecisionItemLineage(rowWithoutBuilderInput);
assert.equal(missingBuilderInput.eligible, false);
assert.equal(missingBuilderInput.nextAction, 'hold_for_review');
assert.ok(missingBuilderInput.reasons.includes('invalid_builder_input_json'));

const cases = [
  ['missing builder ledger', { builder_run_id: null }, 'missing_builder_run_id'],
  ['missing conflict ledger', { conflict_run_id: null }, 'missing_conflict_run_id'],
  ['builder not released', { builder_next_action: 'hold_for_review' }, 'builder_not_released_to_S04'],
  ['S03 not released', { s03_next_action: 'request_evidence' }, 's03_not_released_to_builder'],
  ['builder event mismatch', { builder_event_id: 'EVT-OTHER' }, 'builder_event_mismatch'],
  ['conflict event mismatch', { conflict_event_id: 'EVT-OTHER' }, 'conflict_event_mismatch'],
  ['builder conflict mismatch', { builder_conflict_run_id: 'CR-OTHER' }, 'builder_conflict_mismatch'],
  ['missing builder context', { builder_context_run_id: null }, 'missing_builder_context_run_id'],
  ['missing conflict context', { conflict_context_run_id: null }, 'missing_conflict_context_run_id'],
  ['context run mismatch', { builder_context_run_id: 'CTX-OTHER' }, 'context_run_mismatch'],
  ['missing builder intake', { builder_intake_id: null }, 'missing_builder_intake_id'],
  ['missing conflict intake', { conflict_intake_id: null }, 'missing_conflict_intake_id'],
  ['intake mismatch', { builder_intake_id: 'INTAKE-OTHER' }, 'intake_mismatch'],
  ['decision product mismatch', { decision_product_id: 'PROD-OTHER' }, 'product_lineage_mismatch'],
  ['conflict product mismatch', { conflict_product_id: 'PROD-OTHER' }, 'product_lineage_mismatch'],
  ['decision marketplace mismatch', { decision_marketplace: 'CA' }, 'marketplace_lineage_mismatch'],
  ['conflict marketplace mismatch', { conflict_marketplace: 'CA' }, 'marketplace_lineage_mismatch'],
  ['invalid builder input json', { builder_input_json: '{bad json' }, 'invalid_builder_input_json'],
  ['missing builder scope', { builder_input_json: JSON.stringify({ scope: null }) }, 'missing_builder_scope'],
  ['product scope missing product', {
    builder_input_json: JSON.stringify({ scope: { scope_type: 'product', scope_id: 'PROD-1', product_id: null } }),
  }, 'incomplete_product_scope_lineage'],
  ['product scope mismatch', {
    builder_input_json: JSON.stringify({ scope: { scope_type: 'product', scope_id: 'PROD-OTHER', product_id: 'PROD-OTHER' } }),
  }, 'product_scope_mismatch'],
  ['store scope carrying product', {
    builder_input_json: JSON.stringify({ scope: { scope_type: 'store', scope_id: 'US', product_id: 'PROD-1' } }),
  }, 'store_scope_product_mismatch'],
  ['store scope mismatch', {
    decision_product_id: null,
    builder_product_id: null,
    conflict_product_id: null,
    builder_input_json: JSON.stringify({ scope: { scope_type: 'store', scope_id: 'CA', product_id: null } }),
  }, 'store_scope_mismatch'],
  ['global scope carrying lineage', {
    builder_input_json: JSON.stringify({ scope: { scope_type: 'global', scope_id: '1122', product_id: null } }),
  }, 'global_scope_lineage_mismatch'],
  ['unsupported scope type', {
    builder_input_json: JSON.stringify({ scope: { scope_type: 'account', scope_id: 'A1', product_id: null } }),
  }, 'unsupported_scope_type'],
  ['invalid item json', { decision_item_json: '{bad json' }, 'invalid_decision_item_json'],
  ['item id mismatch', {
    decision_item_json: JSON.stringify({ ...validItem, decision_item_id: 'DI:OTHER:01' }),
  }, 'decision_item_id_mismatch'],
  ['source event mismatch', {
    decision_item_json: JSON.stringify({ ...validItem, source_event_refs: ['EVT-OTHER'] }),
  }, 'source_event_ref_mismatch'],
  ['cross event source ref', {
    decision_item_json: JSON.stringify({ ...validItem, source_event_refs: ['EVT-1', 'EVT-OTHER'] }),
  }, 'cross_event_source_ref'],
  ['missing subject', {
    decision_item_json: JSON.stringify({ ...validItem, subject: '' }),
  }, 'missing_decision_item_subject'],
  ['missing problem definition', {
    decision_item_json: JSON.stringify({ ...validItem, problem_definition: null }),
  }, 'missing_decision_item_problem_definition'],
  ['missing objective', {
    decision_item_json: JSON.stringify({ ...validItem, objective: '' }),
  }, 'missing_decision_item_objective'],
  ['missing goal layer', {
    decision_item_json: JSON.stringify({ ...validItem, goal_layer: '' }),
  }, 'missing_decision_item_goal_layer'],
  ['unsupported item type', {
    decision_item_json: JSON.stringify({ ...validItem, item_type: 'execute_price_change' }),
  }, 'unsupported_decision_item_type'],
  ['unsupported goal layer', {
    decision_item_json: JSON.stringify({ ...validItem, goal_layer: 'override_all_controls' }),
  }, 'unsupported_decision_item_goal_layer'],
  ['missing urgency', {
    decision_item_json: JSON.stringify({ ...validItem, urgency: '' }),
  }, 'missing_decision_item_urgency'],
  ['unsupported urgency', {
    decision_item_json: JSON.stringify({ ...validItem, urgency: 'execute_now' }),
  }, 'unsupported_decision_item_urgency'],
  ['missing evidence strength', {
    decision_item_json: JSON.stringify({ ...validItem, evidence_strength: null }),
  }, 'missing_decision_item_evidence_strength'],
  ['unsupported evidence strength', {
    decision_item_json: JSON.stringify({ ...validItem, evidence_strength: 'guaranteed' }),
  }, 'unsupported_decision_item_evidence_strength'],
  ['unsupported severity', {
    decision_item_json: JSON.stringify({ ...validItem, severity: 'ADMIN_OVERRIDE' }),
  }, 'unsupported_decision_item_severity'],
  ['missing source refs', {
    decision_item_json: JSON.stringify({ ...validItem, source_event_refs: [] }),
  }, 'missing_decision_item_source_event_refs'],
  ['invalid created at', {
    decision_item_json: JSON.stringify({ ...validItem, created_at: 'not-a-date' }),
  }, 'invalid_decision_item_created_at'],
  ['negative dependency count', {
    decision_item_json: JSON.stringify({ ...validItem, dependency_count: -1 }),
  }, 'invalid_decision_item_dependency_count'],
  ['invalid blocked items shape', {
    decision_item_json: JSON.stringify({ ...validItem, blocked_items: 'CR-1' }),
  }, 'invalid_decision_item_blocked_items'],
];

for (const [name, patch, expectedReason] of cases) {
  const result = validateS04DecisionItemLineage({ ...base, ...patch });
  assert.equal(result.eligible, false, name);
  assert.equal(result.nextAction, 'hold_for_review', name);
  assert.ok(result.reasons.includes(expectedReason), `${name}: ${result.reasons.join(',')}`);
}

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_INGRESS_CONTRACT_VERSION,
  happyPath: ready.nextAction,
  prefixedSameEvent: prefixedSameEvent.nextAction,
  storeScope: storeScope.nextAction,
  globalScope: globalScope.nextAction,
  missingBuilderInput: missingBuilderInput.nextAction,
  failClosedCases: cases.map(([name]) => name),
}, null, 2));
