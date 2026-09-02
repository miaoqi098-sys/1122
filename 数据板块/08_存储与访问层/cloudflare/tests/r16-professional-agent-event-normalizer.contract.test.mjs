import assert from 'node:assert/strict';
import {
  normalizeProfessionalAgentEvent,
  R16_EVENT_NORMALIZER_VERSION,
} from '../r16-professional-agent-event-normalizer.js';

const validInput = {
  source_agent: 'Agent-4',
  domain_schema: 'AdvertisingSignalEvent.v1',
  domain_event_id: 'A4-EVT-001',
  domain_event: {
    event_type: 'AD_TARGET_HIGH_CLICKS_NO_ORDER',
    scope: {
      scope_type: 'product',
      scope_id: 'PROD-1',
      product_id: 'PROD-1',
      asin: 'B0TEST001',
    },
    severity: 'high',
    observed_at: '2026-09-03T00:00:00.000Z',
    summary: 'Target recorded high clicks without orders in the observation window.',
    facts: ['The target recorded 42 clicks and 0 orders in the last 7 days.'],
    metrics: { clicks: 42, orders: 0 },
    confidence: 'high',
    evidence_refs: ['d1:ads:target:T-1:2026-09-03'],
    recommendation: 'Review targeting and conversion context before any bid change.',
  },
};

const normalized = normalizeProfessionalAgentEvent(validInput, {
  receivedAt: '2026-09-03T00:01:00.000Z',
  mappedAt: '2026-09-03T00:01:01.000Z',
});
assert.equal(normalized.status, 'normalized');
assert.equal(normalized.nextAction, 'continue_to_A1_event_intake');
assert.equal(normalized.normalizationVersion, R16_EVENT_NORMALIZER_VERSION);
assert.equal(normalized.readOnly, true);
assert.equal(normalized.executionAuthorized, false);
assert.equal(normalized.dispatchAuthorized, false);
assert.equal(normalized.canonicalEvent.source_type, 'professional_agent');
assert.equal(normalized.canonicalEvent.source_agent, 'Agent-4');
assert.equal(normalized.canonicalEvent.source_ref, 'A4-EVT-001');
assert.equal(normalized.canonicalEvent.severity, 'P1');
assert.equal(normalized.canonicalEvent.confidence, 0.85);
assert.equal(normalized.canonicalEvent.product_id, 'PROD-1');
assert.equal(normalized.handoff.protocol_version, '1.0');
assert.equal(normalized.handoff.domain_event_id, 'A4-EVT-001');

const invalidAgent = normalizeProfessionalAgentEvent({ ...validInput, source_agent: 'Agent-1' });
assert.equal(invalidAgent.status, 'blocked');
assert.equal(invalidAgent.nextAction, 'hold_for_review');
assert.deepEqual(invalidAgent.reasons, ['invalid_source_agent']);

const missingFacts = normalizeProfessionalAgentEvent({
  ...validInput,
  domain_event: { ...validInput.domain_event, facts: [] },
});
assert.equal(missingFacts.status, 'blocked');
assert.ok(missingFacts.reasons.includes('invalid_facts'));
assert.equal(missingFacts.canonicalEvent, null);

const missingProductId = normalizeProfessionalAgentEvent({
  ...validInput,
  domain_event: {
    ...validInput.domain_event,
    scope: { scope_type: 'product', scope_id: 'PROD-1' },
  },
});
assert.equal(missingProductId.status, 'blocked');
assert.ok(missingProductId.reasons.includes('missing_product_id_for_product_scope'));

const invalidSeverity = normalizeProfessionalAgentEvent({
  ...validInput,
  domain_event: { ...validInput.domain_event, severity: 'urgent' },
});
assert.equal(invalidSeverity.status, 'blocked');
assert.ok(invalidSeverity.reasons.includes('invalid_severity'));

const invalidDate = normalizeProfessionalAgentEvent({
  ...validInput,
  domain_event: { ...validInput.domain_event, observed_at: 'not-a-date' },
});
assert.equal(invalidDate.status, 'blocked');
assert.ok(invalidDate.reasons.includes('invalid_occurred_at'));

const sourceMismatch = normalizeProfessionalAgentEvent({
  ...validInput,
  domain_event: { ...validInput.domain_event, source_agent: 'Agent-5' },
});
assert.equal(sourceMismatch.status, 'blocked');
assert.ok(sourceMismatch.reasons.includes('source_agent_mismatch'));

const privilegeInjection = normalizeProfessionalAgentEvent({
  ...validInput,
  domain_event: { ...validInput.domain_event, executionAuthorized: true },
});
assert.equal(privilegeInjection.status, 'blocked');
assert.ok(privilegeInjection.reasons.includes('privilege_injection_executionAuthorized'));
assert.equal(privilegeInjection.executionAuthorized, false);

const invalidConfidence = normalizeProfessionalAgentEvent({
  ...validInput,
  domain_event: { ...validInput.domain_event, confidence: 1.5 },
});
assert.equal(invalidConfidence.status, 'blocked');
assert.ok(invalidConfidence.reasons.includes('invalid_confidence'));

console.log('R16 professional agent event normalizer contract: PASS');
