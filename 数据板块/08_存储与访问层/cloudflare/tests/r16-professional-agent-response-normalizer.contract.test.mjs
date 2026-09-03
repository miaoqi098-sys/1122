import assert from 'node:assert/strict';
import {
  normalizeProfessionalAgentResponse,
  R16_RESPONSE_NORMALIZER_VERSION,
} from '../r16-professional-agent-event-normalizer.js';

const validInput = {
  request_id: 'REQ-A1-001',
  responder_agent: 'Agent-4',
  scope: { scope_type: 'product', product_id: 'PROD-1' },
  facts: ['Target recorded 42 clicks and 0 orders in the last 7 days.'],
  interpretation: ['Traffic is present, but conversion evidence is weak.'],
  conclusion: 'The ad target requires cross-agent conversion review before any bid change.',
  recommendation: 'Request Agent-9 content conversion context.',
  confidence: 'high',
  data_window: 'last_7_days',
  evidence_refs: ['d1:ads:target:T-1:2026-09-03'],
  missing_inputs: ['listing_conversion_context'],
  limitations: ['No production write authority.'],
  status: 'partial',
  generated_at: '2026-09-03T00:10:00.000Z',
};

const normalized = normalizeProfessionalAgentResponse(validInput);
assert.equal(normalized.status, 'normalized');
assert.equal(normalized.nextAction, 'continue_to_A1_professional_response_intake');
assert.equal(normalized.normalizationVersion, R16_RESPONSE_NORMALIZER_VERSION);
assert.equal(normalized.readOnly, true);
assert.equal(normalized.executionAuthorized, false);
assert.equal(normalized.dispatchAuthorized, false);
assert.equal(normalized.canonicalResponse.request_id, 'REQ-A1-001');
assert.equal(normalized.canonicalResponse.source_agent, 'Agent-4');
assert.equal(normalized.canonicalResponse.status, 'answered_with_gaps');
assert.equal(normalized.canonicalResponse.confidence, 0.85);
assert.deepEqual(normalized.canonicalResponse.missing_data, ['listing_conversion_context']);
assert.deepEqual(normalized.canonicalResponse.risks, ['No production write authority.']);
assert.equal(normalized.canonicalResponse.metadata.original_status, 'partial');
assert.equal(normalized.canonicalResponse.metadata.original_confidence, 'high');

const missingRequest = normalizeProfessionalAgentResponse({ ...validInput, request_id: '' });
assert.equal(missingRequest.status, 'blocked');
assert.ok(missingRequest.reasons.includes('missing_request_id'));

const invalidAgent = normalizeProfessionalAgentResponse({ ...validInput, responder_agent: 'Agent-1' });
assert.equal(invalidAgent.status, 'blocked');
assert.ok(invalidAgent.reasons.includes('invalid_source_agent'));

const invalidConfidence = normalizeProfessionalAgentResponse({ ...validInput, confidence: 1.5 });
assert.equal(invalidConfidence.status, 'blocked');
assert.ok(invalidConfidence.reasons.includes('invalid_confidence'));

const invalidStatus = normalizeProfessionalAgentResponse({ ...validInput, status: 'done-ish' });
assert.equal(invalidStatus.status, 'blocked');
assert.ok(invalidStatus.reasons.includes('invalid_status'));

const privilegeInjection = normalizeProfessionalAgentResponse({ ...validInput, executionAuthorized: true });
assert.equal(privilegeInjection.status, 'blocked');
assert.ok(privilegeInjection.reasons.includes('privilege_injection_executionAuthorized'));
assert.equal(privilegeInjection.executionAuthorized, false);

const invalidFacts = normalizeProfessionalAgentResponse({ ...validInput, facts: [{ clicks: 42 }] });
assert.equal(invalidFacts.status, 'blocked');
assert.ok(invalidFacts.reasons.includes('invalid_facts'));

console.log('R16 professional agent response normalizer contract: PASS');
