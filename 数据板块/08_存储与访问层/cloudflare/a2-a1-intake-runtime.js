import { runAgent2ProductStatus } from './a2-product-status-runtime.js';
import {
  validateS01,
  S01_VALIDATOR_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S01_事件校验/执行程序/runtime.js';

export const A2_A1_INTAKE_RUNTIME_VERSION = 'A2-A1-intake-runtime-v1.0.0';

function failClosed(reasons) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A2_A1_INTAKE_RUNTIME_VERSION,
    validatorVersion: S01_VALIDATOR_VERSION,
    agent2Result: null,
    s01Result: null,
    canonicalEvent: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function runAgent2ToA1Intake(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return failClosed(['invalid_bridge_input']);
  }

  const agent2Result = runAgent2ProductStatus(input, {
    receivedAt: options.receivedAt,
    mappedAt: options.mappedAt,
  });

  if (agent2Result.status !== 'event_ready') {
    return {
      status: agent2Result.status,
      nextAction: agent2Result.nextAction,
      reasons: agent2Result.reasons ?? [],
      runtimeVersion: A2_A1_INTAKE_RUNTIME_VERSION,
      validatorVersion: S01_VALIDATOR_VERSION,
      agent2Result,
      s01Result: null,
      canonicalEvent: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  const normalized = agent2Result.normalizedEvent;
  const canonicalEvent = normalized?.canonicalEvent;
  if (!normalized || normalized.status !== 'normalized' || !canonicalEvent) {
    return failClosed(['missing_verified_r16_canonical_event']);
  }
  if (normalized.nextAction !== 'continue_to_A1_event_intake') {
    return failClosed(['r16_route_not_allowed_for_a1_intake']);
  }
  if (canonicalEvent.source_type !== 'professional_agent' || canonicalEvent.source_agent !== 'Agent-2') {
    return failClosed(['canonical_source_lineage_mismatch']);
  }

  const expectedProductId = input.current_snapshot?.metadata?.product_id
    ?? input.current_snapshot?.metadata?.asin
    ?? input.current_snapshot?.scope_id
    ?? null;
  if (['product', 'parent_product', 'sku'].includes(canonicalEvent.scope_type)) {
    if (!nonEmptyString(expectedProductId) || canonicalEvent.product_id !== expectedProductId) {
      return failClosed(['canonical_product_lineage_mismatch']);
    }
  }

  const currentTime = options.currentTime ?? canonicalEvent.received_at ?? canonicalEvent.occurred_at;
  const knownProductIds = Array.isArray(options.knownProductIds)
    ? [...options.knownProductIds]
    : nonEmptyString(canonicalEvent.product_id)
      ? [canonicalEvent.product_id]
      : [];
  const existingEvents = Array.isArray(options.existingEvents) ? options.existingEvents : [];

  const s01Result = validateS01({
    event: canonicalEvent,
    known_product_ids: knownProductIds,
    existing_events: existingEvents,
    current_time: currentTime,
    allowed_sources: ['professional_agent', 'Agent-2'],
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
      runtimeVersion: A2_A1_INTAKE_RUNTIME_VERSION,
      validatorVersion: S01_VALIDATOR_VERSION,
      agent2Result,
      s01Result,
      canonicalEvent: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  if (s01Result.next_action !== 'continue_to_S02' || !s01Result.normalized_event) {
    return failClosed(['a1_s01_route_not_allowed']);
  }
  if (s01Result.normalized_event.event_id !== canonicalEvent.event_id) {
    return failClosed(['a1_s01_event_identity_mismatch']);
  }
  if (s01Result.normalized_event.source_agent !== 'Agent-2') {
    return failClosed(['a1_s01_source_lineage_mismatch']);
  }

  return {
    status: 'ready_for_S02',
    nextAction: 'continue_to_S02',
    reasons: [],
    runtimeVersion: A2_A1_INTAKE_RUNTIME_VERSION,
    validatorVersion: S01_VALIDATOR_VERSION,
    agent2Result,
    s01Result,
    canonicalEvent: s01Result.normalized_event,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
