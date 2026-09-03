import assert from 'node:assert/strict';
import { runAgent4AdvertisingSignal } from '../a4-advertising-runtime.js';

function window({ id, start, end, clicks, orders, spend, freshness = 'fresh' }) {
  return {
    window_id: id,
    start_at: start,
    end_at: end,
    clicks,
    attributed_orders: orders,
    spend,
    evidence_refs: [`evidence:${id}`],
    freshness,
  };
}

function makeInput() {
  return {
    input_mode: 'simulated',
    request_id: 'REQ-A4-001',
    scope: {
      scope_type: 'product',
      scope_id: 'PROD-4',
      product_id: 'PROD-4',
      asin: 'B0A4TEST01',
      marketplace: 'US',
    },
    entity: {
      entity_type: 'target',
      entity_id: 'TARGET-001',
    },
    baseline_window: window({
      id: 'A4-W1',
      start: '2026-09-03T00:00:00.000Z',
      end: '2026-09-03T01:00:00.000Z',
      clicks: 20,
      orders: 3,
      spend: 18.5,
    }),
    current_window: window({
      id: 'A4-W2',
      start: '2026-09-03T02:00:00.000Z',
      end: '2026-09-03T03:00:00.000Z',
      clicks: 24,
      orders: 0,
      spend: 23.1,
    }),
    sample_sufficient: true,
  };
}

const options = {
  generatedAt: '2026-09-03T03:00:01.000Z',
  receivedAt: '2026-09-03T03:00:02.000Z',
  mappedAt: '2026-09-03T03:00:03.000Z',
};

const ready = runAgent4AdvertisingSignal(makeInput(), options);
assert.equal(ready.status, 'event_and_response_ready');
assert.equal(ready.nextAction, 'stop_before_A1_intake');
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.domainResponse.responder_agent, 'Agent-4');
assert.equal(ready.normalizedResponse.status, 'normalized');
assert.equal(ready.normalizedResponse.canonicalResponse.source_agent, 'Agent-4');
assert.equal(ready.normalizedResponse.canonicalResponse.status, 'answered');
assert.equal(ready.domainEvent.source_agent, 'Agent-4');
assert.equal(ready.domainEvent.event_type, 'advertising_conversion_breakdown');
assert.equal(ready.normalizedEvent.status, 'normalized');
assert.equal(ready.normalizedEvent.canonicalEvent.source_agent, 'Agent-4');
assert.equal(ready.normalizedEvent.canonicalEvent.event_type, 'advertising_conversion_breakdown');
assert.equal(ready.normalizedEvent.canonicalEvent.product_id, 'PROD-4');
assert.equal(ready.normalizedEvent.canonicalEvent.severity, 'P1');
assert.equal(ready.normalizedEvent.canonicalEvent.metrics.entity_id, 'TARGET-001');
assert.equal(ready.normalizedEvent.executionAuthorized, false);
assert.equal(ready.normalizedResponse.executionAuthorized, false);

const insufficient = makeInput();
insufficient.sample_sufficient = false;
const insufficientResult = runAgent4AdvertisingSignal(insufficient, options);
assert.equal(insufficientResult.status, 'needs_confirmation');
assert.equal(insufficientResult.nextAction, 'observe');
assert.equal(insufficientResult.normalizedEvent, null);
assert.equal(insufficientResult.executionAuthorized, false);

const stillConverting = makeInput();
stillConverting.current_window.attributed_orders = 1;
const stillConvertingResult = runAgent4AdvertisingSignal(stillConverting, options);
assert.equal(stillConvertingResult.status, 'no_confirmed_breakdown');
assert.equal(stillConvertingResult.normalizedEvent, null);
assert.equal(stillConvertingResult.dispatchAuthorized, false);

const clickDecline = makeInput();
clickDecline.current_window.clicks = 10;
const clickDeclineResult = runAgent4AdvertisingSignal(clickDecline, options);
assert.equal(clickDeclineResult.status, 'needs_recheck');
assert.equal(clickDeclineResult.normalizedEvent, null);

const stale = makeInput();
stale.current_window.freshness = 'stale';
const staleResult = runAgent4AdvertisingSignal(stale, options);
assert.equal(staleResult.status, 'blocked');
assert.ok(staleResult.reasons.includes('current_window_not_fresh'));
assert.equal(staleResult.executionAuthorized, false);

const overlapping = makeInput();
overlapping.current_window.start_at = '2026-09-03T00:30:00.000Z';
const overlappingResult = runAgent4AdvertisingSignal(overlapping, options);
assert.equal(overlappingResult.status, 'blocked');
assert.ok(overlappingResult.reasons.includes('advertising_window_lineage_overlap'));

const forgedPrivilege = runAgent4AdvertisingSignal(
  { ...makeInput(), productionWriteAuthorized: true },
  options,
);
assert.equal(forgedPrivilege.status, 'blocked');
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_productionWriteAuthorized'));
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);

const invalidEntity = makeInput();
invalidEntity.entity.entity_type = 'budget_mutation';
const invalidEntityResult = runAgent4AdvertisingSignal(invalidEntity, options);
assert.equal(invalidEntityResult.status, 'blocked');
assert.ok(invalidEntityResult.reasons.includes('invalid_advertising_entity_type'));

console.log('Agent-4 read-only advertising runtime contract: PASS');
