import { runAgent3CompetitorPriceSignal } from './a3-competitor-price-runtime.js';
import {
  validateS01,
  S01_VALIDATOR_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S01_事件校验/执行程序/runtime.js';

export const A3_A1_INTAKE_RUNTIME_VERSION = 'A3-A1-intake-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'stateTransitionAuthorized',
  'productionWriteAuthorized',
  'finalDecision',
  'task',
]);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function failClosed(reasons, agent3Result = null, s01Result = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A3_A1_INTAKE_RUNTIME_VERSION,
    validatorVersion: S01_VALIDATOR_VERSION,
    agent3Result,
    s01Result,
    canonicalEvent: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}

export function runAgent3ToA1Intake(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return failClosed(['invalid_bridge_input']);
  }

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const agent3Result = runAgent3CompetitorPriceSignal(input, {
    receivedAt: options.receivedAt,
    mappedAt: options.mappedAt,
  });

  if (agent3Result.status !== 'event_ready') {
    return {
      status: agent3Result.status,
      nextAction: agent3Result.nextAction,
      reasons: agent3Result.reasons ?? [],
      runtimeVersion: A3_A1_INTAKE_RUNTIME_VERSION,
      validatorVersion: S01_VALIDATOR_VERSION,
      agent3Result,
      s01Result: null,
      canonicalEvent: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  const normalized = agent3Result.normalizedEvent;
  const canonicalEvent = normalized?.canonicalEvent;
  if (!normalized || normalized.status !== 'normalized' || !canonicalEvent) {
    return failClosed(['missing_verified_r16_canonical_event'], agent3Result);
  }
  if (normalized.nextAction !== 'continue_to_A1_event_intake') {
    return failClosed(['r16_route_not_allowed_for_a1_intake'], agent3Result);
  }
  if (canonicalEvent.source_type !== 'professional_agent' || canonicalEvent.source_agent !== 'Agent-3') {
    return failClosed(['canonical_source_lineage_mismatch'], agent3Result);
  }
  if (canonicalEvent.event_type !== 'competitor_price_shift') {
    return failClosed(['canonical_event_type_not_allowed'], agent3Result);
  }

  const expectedProductId = input.our_scope?.product_id ?? null;
  if (!nonEmptyString(expectedProductId) || canonicalEvent.product_id !== expectedProductId) {
    return failClosed(['canonical_product_lineage_mismatch'], agent3Result);
  }
  if (canonicalEvent.scope_type !== 'product' || canonicalEvent.scope_id !== input.our_scope?.scope_id) {
    return failClosed(['canonical_scope_lineage_mismatch'], agent3Result);
  }

  const competitorId = input.current_snapshot?.competitor_entity_id ?? null;
  if (!nonEmptyString(competitorId) || canonicalEvent.metrics?.competitor_entity_id !== competitorId) {
    return failClosed(['canonical_competitor_lineage_mismatch'], agent3Result);
  }

  const currentTime = options.currentTime ?? canonicalEvent.received_at ?? canonicalEvent.occurred_at;
  const knownProductIds = Array.isArray(options.knownProductIds)
    ? [...options.knownProductIds]
    : [expectedProductId];
  const existingEvents = Array.isArray(options.existingEvents) ? options.existingEvents : [];

  const s01Result = validateS01({
    event: canonicalEvent,
    known_product_ids: knownProductIds,
    existing_events: existingEvents,
    current_time: currentTime,
    allowed_sources: ['professional_agent', 'Agent-3'],
  });

  if (!['passed', 'passed_with_warnings'].includes(s01Result.status)) {
    return {
      status: 'blocked',
      nextAction: s01Result.next_action === 'request_information' ? 'request_information' : 'hold_for_review',
      reasons: [
        'a1_s01_intake_not_ready',
        ...(s01Result.blocking_errors ?? []).map((item) => item.code),
        ...(s01Result.missing_information ?? []).map((item) => `missing:${item}`),
      ],
      runtimeVersion: A3_A1_INTAKE_RUNTIME_VERSION,
      validatorVersion: S01_VALIDATOR_VERSION,
      agent3Result,
      s01Result,
      canonicalEvent: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  if (s01Result.next_action !== 'continue_to_S02' || !s01Result.normalized_event) {
    return failClosed(['a1_s01_route_not_allowed'], agent3Result, s01Result);
  }
  if (s01Result.normalized_event.event_id !== canonicalEvent.event_id) {
    return failClosed(['a1_s01_event_identity_mismatch'], agent3Result, s01Result);
  }
  if (s01Result.normalized_event.source_agent !== 'Agent-3') {
    return failClosed(['a1_s01_source_lineage_mismatch'], agent3Result, s01Result);
  }
  if (s01Result.normalized_event.product_id !== expectedProductId) {
    return failClosed(['a1_s01_product_lineage_mismatch'], agent3Result, s01Result);
  }

  return {
    status: 'ready_for_S02',
    nextAction: 'continue_to_S02',
    reasons: [],
    runtimeVersion: A3_A1_INTAKE_RUNTIME_VERSION,
    validatorVersion: S01_VALIDATOR_VERSION,
    agent3Result,
    s01Result,
    canonicalEvent: s01Result.normalized_event,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
