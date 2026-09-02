import assert from 'node:assert/strict';
import {
  validateS04DecisionItemLineage,
  S04_INGRESS_CONTRACT_VERSION,
} from '../s04-ingress.js';

const base = {
  decision_item_id: 'DI:EVT-1:01',
  builder_run_id: 'BR-1',
  conflict_run_id: 'CR-1',
  builder_conflict_run_id: 'CR-1',
  event_id: 'EVT-1',
  builder_event_id: 'EVT-1',
  conflict_event_id: 'EVT-1',
  builder_next_action: 'continue_to_S04',
  s03_next_action: 'continue_to_decision_item_builder',
  decision_item_json: JSON.stringify({
    decision_item_id: 'DI:EVT-1:01',
    source_event_refs: ['EVT-1'],
    item_type: 'problem',
  }),
};

const ready = validateS04DecisionItemLineage(base);
assert.equal(ready.contractVersion, S04_INGRESS_CONTRACT_VERSION);
assert.equal(ready.eligible, true);
assert.equal(ready.nextAction, 'continue_to_S04');
assert.deepEqual(ready.reasons, []);

const cases = [
  ['missing builder ledger', { builder_run_id: null }, 'missing_builder_run_id'],
  ['missing conflict ledger', { conflict_run_id: null }, 'missing_conflict_run_id'],
  ['builder not released', { builder_next_action: 'hold_for_review' }, 'builder_not_released_to_S04'],
  ['S03 not released', { s03_next_action: 'request_evidence' }, 's03_not_released_to_builder'],
  ['builder event mismatch', { builder_event_id: 'EVT-OTHER' }, 'builder_event_mismatch'],
  ['conflict event mismatch', { conflict_event_id: 'EVT-OTHER' }, 'conflict_event_mismatch'],
  ['builder conflict mismatch', { builder_conflict_run_id: 'CR-OTHER' }, 'builder_conflict_mismatch'],
  ['invalid item json', { decision_item_json: '{bad json' }, 'invalid_decision_item_json'],
  ['item id mismatch', {
    decision_item_json: JSON.stringify({ decision_item_id: 'DI:OTHER:01', source_event_refs: ['EVT-1'] }),
  }, 'decision_item_id_mismatch'],
  ['source event mismatch', {
    decision_item_json: JSON.stringify({ decision_item_id: 'DI:EVT-1:01', source_event_refs: ['EVT-OTHER'] }),
  }, 'source_event_ref_mismatch'],
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
  failClosedCases: cases.map(([name]) => name),
}, null, 2));
