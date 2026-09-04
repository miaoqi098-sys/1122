import { runAgent5ToA1Intake } from './a5-a1-intake-runtime.js';
import { buildDefaultContextRequest } from './s02-context.js';
import {
  planContextDomains,
  runS02,
  S02_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S02_上下文装载/执行程序/runtime.js';

export const A5_A1_S02_RUNTIME_VERSION = 'A5-A1-S02-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'stateTransitionAuthorized',
  'productionWriteAuthorized',
  'approvalGranted',
  'taskAuthorized',
  'finalDecision',
  'task',
]);

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

function failClosed(reasons, intakeResult = null, s02Result = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A5_A1_S02_RUNTIME_VERSION,
    s02RuntimeVersion: S02_RUNTIME_VERSION,
    intakeResult,
    s02Result,
    canonicalEvent: null,
    contextPackage: null,
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}

function validateBoundary(input) {
  if (!isObject(input)) return ['invalid_runtime_input'];
  const reasons = [];
  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) reasons.push(`privilege_injection_${key}`);
  }
  if (input.source_agent !== undefined && input.source_agent !== 'Agent-5') reasons.push('input_source_agent_mismatch');
  return reasons;
}

function validateAgent5Lineage(input, intakeResult) {
  const reasons = [];
  const event = intakeResult?.canonicalEvent;
  const agent5Result = intakeResult?.agent5Result;
  const normalized = agent5Result?.normalizedEvent;
  const domainEvent = agent5Result?.domainEvent;

  if (!isObject(event)) return ['missing_a1_normalized_event'];
  if (!isObject(normalized) || !isObject(normalized.canonicalEvent) || !isObject(domainEvent)) return ['missing_agent5_r16_lineage'];

  if (event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-5') reasons.push('a1_event_source_lineage_mismatch');
  if (event.event_type !== 'traffic_session_decline') reasons.push('a1_event_type_not_allowed');
  if (event.event_id !== domainEvent.event_id || event.event_id !== normalized.canonicalEvent.event_id || event.source_ref !== domainEvent.event_id) {
    reasons.push('agent5_event_identity_lineage_mismatch');
  }

  const productId = input.scope?.product_id ?? null;
  if (!nonEmptyString(productId) || event.product_id !== productId || event.scope_type !== 'product' || event.scope_id !== input.scope?.scope_id) {
    reasons.push('agent5_product_scope_lineage_mismatch');
  }
  if (event.metrics?.product_id !== productId) reasons.push('agent5_traffic_product_metric_lineage_mismatch');
  if (event.metrics?.baseline_window_id !== input.baseline_window?.window_id || event.metrics?.current_window_id !== input.current_window?.window_id) {
    reasons.push('agent5_traffic_window_lineage_mismatch');
  }
  if (intakeResult.s01Result?.normalized_event?.event_id !== event.event_id
      || intakeResult.s01Result?.normalized_event?.source_agent !== 'Agent-5'
      || intakeResult.s01Result?.normalized_event?.product_id !== productId) {
    reasons.push('a1_s01_lineage_mismatch');
  }
  return reasons;
}

export function runAgent5ToS02(input, options = {}) {
  const boundaryReasons = validateBoundary(input);
  if (boundaryReasons.length) return failClosed(boundaryReasons);
  if (!isObject(options.availableContext)) return failClosed(['missing_available_context']);

  const intakeResult = runAgent5ToA1Intake(input, {
    generatedAt: options.generatedAt,
    receivedAt: options.receivedAt,
    mappedAt: options.mappedAt,
    currentTime: options.currentTime,
    knownProductIds: options.knownProductIds,
    existingEvents: options.existingEvents,
  });

  if (intakeResult.status !== 'ready_for_S02') {
    return {
      ...failClosed(intakeResult.reasons ?? ['agent5_intake_not_ready'], intakeResult),
      status: intakeResult.status,
      nextAction: intakeResult.nextAction,
    };
  }
  if (intakeResult.nextAction !== 'continue_to_S02') return failClosed(['a1_intake_route_not_allowed_for_s02'], intakeResult);
  if (!['passed', 'passed_with_warnings'].includes(intakeResult.s01Result?.status)) return failClosed(['a1_s01_not_verified'], intakeResult);

  const lineageReasons = validateAgent5Lineage(input, intakeResult);
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
    return failClosed(['s02_blocked', ...(s02Result.missing_context ?? []).map((item) => `missing:${item.domain ?? 'unknown'}`)], intakeResult, s02Result);
  }
  if (s02Result.status === 'needs_information') {
    return {
      status: 'needs_information',
      nextAction: s02Result.next_action === 'refresh_context' ? 'refresh_context' : 'request_information',
      reasons: (s02Result.missing_context ?? []).map((item) => `missing:${item.domain ?? 'unknown'}`),
      runtimeVersion: A5_A1_S02_RUNTIME_VERSION,
      s02RuntimeVersion: S02_RUNTIME_VERSION,
      intakeResult,
      s02Result,
      canonicalEvent: event,
      contextPackage: null,
      readOnly: true,
      approvalGranted: false,
      permissionGranted: false,
      taskAuthorized: false,
      executionAuthorized: false,
      dispatchAuthorized: false,
      productionWriteAuthorized: false,
    };
  }
  if (!['ready', 'ready_with_gaps'].includes(s02Result.status)) return failClosed(['unknown_s02_status'], intakeResult, s02Result);
  if (s02Result.next_action !== 'continue_analysis') return failClosed(['s02_route_not_allowed'], intakeResult, s02Result);
  if (!isObject(s02Result.context_package) || Object.keys(s02Result.context_package).length === 0) return failClosed(['empty_s02_context_package'], intakeResult, s02Result);
  if (s02Result.scope?.product_id !== event.product_id) return failClosed(['s02_product_lineage_mismatch'], intakeResult, s02Result);

  return {
    status: 'ready_for_S03',
    nextAction: 'continue_to_S03',
    reasons: [],
    runtimeVersion: A5_A1_S02_RUNTIME_VERSION,
    s02RuntimeVersion: S02_RUNTIME_VERSION,
    plannedDomains,
    intakeResult,
    s02Result,
    canonicalEvent: event,
    contextPackage: s02Result.context_package,
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}
