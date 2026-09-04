import assert from 'node:assert/strict';
import { runAgent5TrafficSignal } from '../a5-traffic-runtime.js';

function window({ id, start, end, sessions, freshness = 'fresh' }) {
  return {
    window_id: id,
    start_at: start,
    end_at: end,
    sessions,
    evidence_refs: [`evidence:${id}`],
    freshness,
  };
}

function makeInput() {
  return {
    input_mode: 'simulated',
    request_id: 'REQ-A5-001',
    scope: {
      scope_type: 'product',
      scope_id: 'PROD-5',
      product_id: 'PROD-5',
      asin: 'B0A5TEST01',
      marketplace: 'US',
    },
    baseline_window: window({
      id: 'A5-W1',
      start: '2026-09-03T00:00:00.000Z',
      end: '2026-09-03T01:00:00.000Z',
      sessions: 100,
    }),
    current_window: window({
      id: 'A5-W2',
      start: '2026-09-03T02:00:00.000Z',
      end: '2026-09-03T03:00:00.000Z',
      sessions: 70,
    }),
    sample_comparable: true,
    sample_sufficient: true,
  };
}

const options = {
  generatedAt: '2026-09-03T03:00:01.000Z',
  receivedAt: '2026-09-03T03:00:02.000Z',
  mappedAt: '2026-09-03T03:00:03.000Z',
};

const ready = runAgent5TrafficSignal(makeInput(), options);
assert.equal(ready.status, 'event_and_response_ready');
assert.equal(ready.nextAction, 'stop_before_A1_intake');
assert.equal(ready.readOnly, true);
assert.equal(ready.executionAuthorized, false);
assert.equal(ready.dispatchAuthorized, false);
assert.equal(ready.domainResponse.responder_agent, 'Agent-5');
assert.equal(ready.domainEvent.source_agent, 'Agent-5');
assert.equal(ready.domainEvent.event_type, 'traffic_session_decline');
assert.equal(ready.domainEvent.metrics.decline_pct, 30);
assert.equal(ready.normalizedResponse.status, 'normalized');
assert.equal(ready.normalizedResponse.canonicalResponse.source_agent, 'Agent-5');
assert.equal(ready.normalizedEvent.status, 'normalized');
assert.equal(ready.normalizedEvent.canonicalEvent.source_agent, 'Agent-5');
assert.equal(ready.normalizedEvent.canonicalEvent.event_type, 'traffic_session_decline');
assert.equal(ready.normalizedEvent.canonicalEvent.product_id, 'PROD-5');
assert.equal(ready.normalizedEvent.executionAuthorized, false);

const insufficient = makeInput();
insufficient.sample_sufficient = false;
const insufficientResult = runAgent5TrafficSignal(insufficient, options);
assert.equal(insufficientResult.status, 'needs_confirmation');
assert.equal(insufficientResult.normalizedEvent, null);

const smallDecline = makeInput();
smallDecline.current_window.sessions = 85;
const smallDeclineResult = runAgent5TrafficSignal(smallDecline, options);
assert.equal(smallDeclineResult.status, 'needs_recheck');
assert.equal(smallDeclineResult.normalizedEvent, null);

const noDecline = makeInput();
noDecline.current_window.sessions = 100;
const noDeclineResult = runAgent5TrafficSignal(noDecline, options);
assert.equal(noDeclineResult.status, 'no_confirmed_decline');
assert.equal(noDeclineResult.normalizedEvent, null);

const stale = makeInput();
stale.current_window.freshness = 'stale';
const staleResult = runAgent5TrafficSignal(stale, options);
assert.equal(staleResult.status, 'blocked');
assert.ok(staleResult.reasons.includes('current_window_not_fresh'));
assert.equal(staleResult.executionAuthorized, false);

const overlapping = makeInput();
overlapping.current_window.start_at = '2026-09-03T00:30:00.000Z';
const overlappingResult = runAgent5TrafficSignal(overlapping, options);
assert.equal(overlappingResult.status, 'blocked');
assert.ok(overlappingResult.reasons.includes('traffic_window_lineage_overlap'));

const forgedPrivilege = runAgent5TrafficSignal(
  { ...makeInput(), productionWriteAuthorized: true },
  options,
);
assert.equal(forgedPrivilege.status, 'blocked');
assert.ok(forgedPrivilege.reasons.includes('privilege_injection_productionWriteAuthorized'));
assert.equal(forgedPrivilege.executionAuthorized, false);
assert.equal(forgedPrivilege.dispatchAuthorized, false);

console.log('Agent-5 read-only traffic runtime contract: PASS');
