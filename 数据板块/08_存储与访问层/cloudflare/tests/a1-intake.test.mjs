import assert from 'node:assert/strict';
import { buildCanonicalEvent } from '../a1-intake.js';
import { validateS01, S01_VALIDATOR_VERSION } from '../../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S01_事件校验/执行程序/runtime.js';

const raw = {
  event_id: 'evt-test-001',
  product_id: 'prod-test-001',
  marketplace: 'US',
  event_type: 'AMAZON_SESSIONS_DROP',
  severity: 'HIGH',
  source: 'derived_layer_v1',
  event_status: 'NEW',
  processing_disposition: 'AWAITING_A1',
  evidence_json: JSON.stringify({
    metricKey: 'amazon.sessions',
    currentValue: 75,
    priorValue: 101,
    baseline7d: 100,
    deltaPct: -0.25,
    historyPoints: 7,
    threshold: { deltaPctLte: -0.2 },
  }),
  payload_json: JSON.stringify({ engineVersion: 'derived-v1.1', deterministic: true }),
  occurred_at: '2026-09-01T00:00:00Z',
};

const product = { product_id: 'prod-test-001', marketplace: 'US', asin: 'B0TEST0001' };
const canonical = buildCanonicalEvent(raw, product, '2026-09-01T01:00:00Z');

assert.equal(canonical.source_type, 'system');
assert.equal(canonical.source_agent, null, 'system event must not impersonate a professional Agent');
assert.equal(canonical.source_actor, '1122-derived-layer');
assert.equal(canonical.severity, 'P1');
assert.equal(canonical.scope_type, 'product');
assert.equal(canonical.product_id, product.product_id);
assert.equal(canonical.asin, product.asin);
assert.ok(Array.isArray(canonical.scope_objects));
assert.ok(canonical.scope_objects.length === 1);
assert.ok(canonical.facts.some((x) => x.includes('75')));
assert.ok(canonical.facts.some((x) => x.includes('100')));

const passed = validateS01({
  event: canonical,
  known_product_ids: [product.product_id],
  current_time: '2026-09-01T01:00:00Z',
});
assert.ok(['passed', 'passed_with_warnings'].includes(passed.status));
assert.equal(passed.next_action, 'continue_to_S02');
assert.equal(passed.normalized_event.source_type, 'system');
assert.equal(passed.normalized_event.source_agent, null);
assert.equal(passed.normalized_event.severity, 'P1');
assert.equal(passed.validator_version, S01_VALIDATOR_VERSION);

const missingProduct = validateS01({
  event: { ...canonical, event_id: 'evt-test-002', product_id: null },
  current_time: '2026-09-01T01:00:00Z',
});
assert.equal(missingProduct.status, 'needs_information');
assert.ok(missingProduct.missing_information.includes('product_id'));
assert.equal(missingProduct.normalized_event, null);

const fakeProfessionalAgent = validateS01({
  event: {
    ...canonical,
    event_id: 'evt-test-003',
    source_type: 'professional_agent',
    source_agent: null,
  },
  known_product_ids: [product.product_id],
  current_time: '2026-09-01T01:00:00Z',
});
assert.equal(fakeProfessionalAgent.status, 'rejected');
assert.ok(fakeProfessionalAgent.blocking_errors.some((x) => x.code === 'SOURCE_MISSING'));

const duplicate = validateS01({
  event: { ...canonical, event_id: 'evt-test-004' },
  known_product_ids: [product.product_id],
  existing_events: [canonical],
  current_time: '2026-09-01T01:00:00Z',
});
assert.ok(duplicate.duplicate_signal.is_possible_duplicate);
assert.ok(duplicate.warnings.some((x) => x.code === 'POSSIBLE_DUPLICATE'));

console.log(JSON.stringify({
  success: true,
  validatorVersion: S01_VALIDATOR_VERSION,
  canonicalSourceType: canonical.source_type,
  canonicalSeverity: canonical.severity,
  passedStatus: passed.status,
  missingProductStatus: missingProduct.status,
  fakeAgentStatus: fakeProfessionalAgent.status,
  duplicateDetected: duplicate.duplicate_signal.is_possible_duplicate,
}, null, 2));
