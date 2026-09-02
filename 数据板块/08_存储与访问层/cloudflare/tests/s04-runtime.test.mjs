import assert from 'node:assert/strict';
import {
  runS04Runtime,
  S04_RUNTIME_CONTRACT_VERSION,
} from '../s04-runtime.js';

const validRow = {
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
    scope: { scope_type: 'product', scope_id: 'PROD-1', product_id: 'PROD-1' },
  }),
  builder_next_action: 'continue_to_S04',
  s03_next_action: 'continue_to_decision_item_builder',
  decision_item_json: JSON.stringify({
    decision_item_id: 'DI:EVT-1:01',
    source_event_refs: ['EVT-1'],
    item_type: 'problem',
  }),
};

function dbReturning(row, state = {}) {
  return {
    prepare(sql) {
      state.sql = sql;
      return {
        bind(value) {
          state.boundId = value;
          return {
            async first() { return row; },
          };
        },
      };
    },
  };
}

const missingId = await runS04Runtime({ CORE_DB: dbReturning(validRow) }, {});
assert.equal(missingId.eligible, false);
assert.equal(missingId.nextAction, 'hold_for_review');
assert.deepEqual(missingId.reasons, ['missing_decision_item_id']);

const missingDb = await runS04Runtime({}, { decision_item_id: 'DI:EVT-1:01' });
assert.equal(missingDb.eligible, false);
assert.deepEqual(missingDb.reasons, ['database_unavailable']);

const missingPersisted = await runS04Runtime(
  { CORE_DB: dbReturning(null) },
  { decision_item_id: 'DI:EVT-1:01' },
);
assert.equal(missingPersisted.eligible, false);
assert.deepEqual(missingPersisted.reasons, ['missing_persisted_lineage']);

const throwingDb = {
  prepare() { throw new Error('temporary database failure'); },
};
const lookupFailure = await runS04Runtime(
  { CORE_DB: throwingDb },
  { decision_item_id: 'DI:EVT-1:01' },
);
assert.equal(lookupFailure.eligible, false);
assert.deepEqual(lookupFailure.reasons, ['persisted_lineage_lookup_failed']);

const corruptPersisted = await runS04Runtime(
  { CORE_DB: dbReturning({ ...validRow, decision_item_json: '{bad json' }) },
  { decision_item_id: 'DI:EVT-1:01' },
);
assert.equal(corruptPersisted.eligible, false);
assert.ok(corruptPersisted.reasons.includes('invalid_decision_item_json'));

const mismatchedLineage = await runS04Runtime(
  { CORE_DB: dbReturning({ ...validRow, builder_event_id: 'EVT-OTHER' }) },
  { decision_item_id: 'DI:EVT-1:01' },
);
assert.equal(mismatchedLineage.eligible, false);
assert.ok(mismatchedLineage.reasons.includes('builder_event_mismatch'));

const forgedState = {};
const forgedCaller = await runS04Runtime(
  { CORE_DB: dbReturning(null, forgedState) },
  {
    decision_item_id: 'DI:EVT-1:01',
    decision_item: JSON.parse(validRow.decision_item_json),
    builder_run: { builder_run_id: 'BR-1', next_action: 'continue_to_S04' },
    conflict_run: { conflict_run_id: 'CR-1', next_action: 'continue_to_decision_item_builder' },
  },
);
assert.equal(forgedCaller.eligible, false);
assert.deepEqual(forgedCaller.reasons, ['missing_persisted_lineage']);
assert.equal(forgedState.boundId, 'DI:EVT-1:01');

const state = {};
const ready = await runS04Runtime(
  { CORE_DB: dbReturning(validRow, state) },
  {
    decision_item_id: '  DI:EVT-1:01  ',
    decision_item: { decision_item_id: 'FORGED' },
  },
);
assert.equal(ready.contractVersion, S04_RUNTIME_CONTRACT_VERSION);
assert.equal(ready.status, 'ready');
assert.equal(ready.eligible, true);
assert.equal(ready.nextAction, 'continue_to_S04');
assert.equal(ready.decisionItemId, 'DI:EVT-1:01');
assert.equal(ready.decisionItem.decision_item_id, 'DI:EVT-1:01');
assert.equal(state.boundId, 'DI:EVT-1:01');
assert.match(state.sql, /FROM a1_decision_items d/);

console.log(JSON.stringify({
  success: true,
  contractVersion: S04_RUNTIME_CONTRACT_VERSION,
  happyPath: ready.nextAction,
  failClosedCases: [
    'missing decision item id',
    'database unavailable',
    'missing persisted lineage',
    'database lookup failure',
    'corrupt persisted item',
    'lineage mismatch',
    'forged caller payload ignored',
  ],
}, null, 2));
