import { runAgent3ToA1Intake } from './a3-a1-intake-runtime.js';
import { buildDefaultContextRequest } from './s02-context.js';
import {
  planContextDomains,
  runS02,
  S02_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S02_上下文装载/执行程序/runtime.js';

export const A3_A1_S02_RUNTIME_VERSION = 'A3-A1-S02-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'stateTransitionAuthorized',
  'productionWriteAuthorized',
  'finalDecision',
  'task',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function failClosed(reasons, intakeResult = null, s02Result = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A3_A1_S02_RUNTIME_VERSION,
    s02RuntimeVersion: S02_RUNTIME_VERSION,
    intakeResult,
    s02Result,
    canonicalEvent: null,
    contextPackage: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}

function validateInputBoundary(input) {
  const reasons = [];
  if (!isObject(input)) return ['invalid_runtime_input'];

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      reasons.push(`privilege_injection_${key}`);
    }
  }
  if (input.source_agent !== undefined && input.source_agent !== 'Agent-3') {
    reasons.push('input_source_agent_mismatch');
  }
  return reasons;
}

function validateAgent3Lineage(input, intakeResult) {
  const reasons = [];
  const event = intakeResult?.canonicalEvent;
  const agent3Result = intakeResult?.agent3Result;
  const domainEvent = agent3Result?.domainEvent;
  const normalized = agent3Result?.normalizedEvent;

  if (!isObject(event)) return ['missing_a1_normalized_event'];
  if (!isObject(domainEvent) || !isObject(normalized) || !isObject(normalized.canonicalEvent)) {
    return ['missing_agent3_r16_lineage'];
  }

  if (event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-3') {
    reasons.push('a1_event_source_lineage_mismatch');
  }
  if (event.event_type !== 'competitor_price_shift') {
    reasons.push('a1_event_type_not_allowed');
  }
  if (event.event_id !== domainEvent.event_id
      || event.event_id !== normalized.canonicalEvent.event_id
      || event.source_ref !== domainEvent.event_id) {
    reasons.push('agent3_event_identity_lineage_mismatch');
  }

  const expectedProductId = input.our_scope?.product_id ?? null;
  const expectedScopeId = input.our_scope?.scope_id ?? null;
  if (!nonEmptyString(expectedProductId)
      || event.product_id !== expectedProductId
      || event.scope_type !== 'product'
      || event.scope_id !== expectedScopeId) {
    reasons.push('agent3_product_scope_lineage_mismatch');
  }

  const current = input.current_snapshot;
  const baseline = input.baseline_snapshot;
  const expectedCompetitorId = current?.competitor_entity_id ?? null;
  const expectedRelationship = Array.isArray(current?.relationship_types)
    && current.relationship_types.includes('direct_competitor')
    ? 'direct_competitor'
    : null;

  if (!nonEmptyString(expectedCompetitorId)
      || event.metrics?.competitor_entity_id !== expectedCompetitorId
      || event.metrics?.relationship_type !== expectedRelationship
      || event.metrics?.baseline_snapshot_id !== baseline?.snapshot_id
      || event.metrics?.current_snapshot_id !== current?.snapshot_id) {
    reasons.push('agent3_competitor_lineage_mismatch');
  }

  if (intakeResult.s01Result?.normalized_event?.event_id !== event.event_id
      || intakeResult.s01Result?.normalized_event?.source_agent !== 'Agent-3'
      || intakeResult.s01Result?.normalized_event?.product_id !== expectedProductId) {
    reasons.push('a1_s01_lineage_mismatch');
  }

  return reasons;
}

/**
 * Read-only Agent-3 -> A1 S02 bridge.
 *
 * This bridge never accepts a pre-authorized action. It re-runs the verified
 * Agent-3 -> R16 -> S01 path, checks event/product/competitor lineage, and only
 * then invokes the shared S02 context loader. Any anomaly is fail-closed.
 */
export function runAgent3ToS02(input, options = {}) {
  const boundaryReasons = validateInputBoundary(input);
  if (boundaryReasons.length) return failClosed(boundaryReasons);
  if (!isObject(options.availableContext)) {
    return failClosed(['missing_available_context']);
  }

  const intakeResult = runAgent3ToA1Intake(input, {
    receivedAt: options.receivedAt,
    mappedAt: options.mappedAt,
    currentTime: options.currentTime,
    knownProductIds: options.knownProductIds,
    existingEvents: options.existingEvents,
  });

  if (intakeResult.status !== 'ready_for_S02') {
    return {
      status: intakeResult.status,
      nextAction: intakeResult.nextAction,
      reasons: intakeResult.reasons ?? [],
      runtimeVersion: A3_A1_S02_RUNTIME_VERSION,
      s02RuntimeVersion: S02_RUNTIME_VERSION,
      intakeResult,
      s02Result: null,
      canonicalEvent: null,
      contextPackage: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  if (intakeResult.nextAction !== 'continue_to_S02') {
    return failClosed(['a1_intake_route_not_allowed_for_s02'], intakeResult);
  }
  if (!['passed', 'passed_with_warnings'].includes(intakeResult.s01Result?.status)) {
    return failClosed(['a1_s01_not_verified'], intakeResult);
  }

  const lineageReasons = validateAgent3Lineage(input, intakeResult);
  if (lineageReasons.length) return failClosed(lineageReasons, intakeResult);

  const event = intakeResult.canonicalEvent;
  const contextRequest = {
    ...buildDefaultContextRequest(event),
    ...(isObject(options.contextRequest) ? options.contextRequest : {}),
  };
  const plannedDomains = planContextDomains(event, contextRequest);

  const s02Result = runS02({
    validated_event: event,
    s01_validation: {
      status: intakeResult.s01Result.status,
      warnings: intakeResult.s01Result.warnings ?? [],
      duplicate_signal: intakeResult.s01Result.duplicate_signal ?? {},
      validation_summary: intakeResult.s01Result.validation_summary ?? null,
      validator_version: intakeResult.s01Result.validator_version ?? null,
    },
    context_request: contextRequest,
    available_context: options.availableContext,
    current_time: options.currentTime ?? event.received_at ?? event.occurred_at,
  });

  if (!isObject(s02Result)) return failClosed(['missing_s02_result'], intakeResult);

  if (s02Result.status === 'blocked') {
    return failClosed(
      ['s02_blocked', ...(s02Result.missing_context ?? []).map((item) => `missing:${item.domain ?? 'unknown'}`)],
      intakeResult,
      s02Result,
    );
  }

  if (s02Result.status === 'needs_information') {
    return {
      status: 'needs_information',
      nextAction: s02Result.next_action === 'refresh_context' ? 'refresh_context' : 'request_information',
      reasons: (s02Result.missing_context ?? []).map((item) => `missing:${item.domain ?? 'unknown'}`),
      runtimeVersion: A3_A1_S02_RUNTIME_VERSION,
      s02RuntimeVersion: S02_RUNTIME_VERSION,
      intakeResult,
      s02Result,
      canonicalEvent: event,
      contextPackage: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  if (!['ready', 'ready_with_gaps'].includes(s02Result.status)) {
    return failClosed(['unknown_s02_status'], intakeResult, s02Result);
  }
  if (s02Result.next_action !== 'continue_analysis') {
    return failClosed(['s02_route_not_allowed'], intakeResult, s02Result);
  }
  if (!isObject(s02Result.context_package) || Object.keys(s02Result.context_package).length === 0) {
    return failClosed(['empty_s02_context_package'], intakeResult, s02Result);
  }
  if (s02Result.scope?.product_id !== event.product_id) {
    return failClosed(['s02_product_lineage_mismatch'], intakeResult, s02Result);
  }

  return {
    status: 'ready_for_S03',
    nextAction: 'continue_to_S03',
    reasons: [],
    runtimeVersion: A3_A1_S02_RUNTIME_VERSION,
    s02RuntimeVersion: S02_RUNTIME_VERSION,
    plannedDomains,
    intakeResult,
    s02Result,
    canonicalEvent: event,
    contextPackage: s02Result.context_package,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
