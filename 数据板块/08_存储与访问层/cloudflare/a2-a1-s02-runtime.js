import { runAgent2ToA1Intake } from './a2-a1-intake-runtime.js';
import { buildDefaultContextRequest } from './s02-context.js';
import {
  planContextDomains,
  runS02,
  S02_RUNTIME_VERSION,
} from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S02_上下文装载/执行程序/runtime.js';

export const A2_A1_S02_RUNTIME_VERSION = 'A2-A1-S02-runtime-v1.0.0';

function failClosed(reasons, intakeResult = null, s02Result = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A2_A1_S02_RUNTIME_VERSION,
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

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function runAgent2ToS02(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);
  if (!isObject(options.availableContext)) {
    return failClosed(['missing_available_context']);
  }

  const intakeResult = runAgent2ToA1Intake(input, {
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
      runtimeVersion: A2_A1_S02_RUNTIME_VERSION,
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

  const event = intakeResult.canonicalEvent;
  if (!isObject(event)) return failClosed(['missing_a1_normalized_event'], intakeResult);
  if (event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-2') {
    return failClosed(['a1_event_source_lineage_mismatch'], intakeResult);
  }
  if (event.event_id !== intakeResult.s01Result?.normalized_event?.event_id) {
    return failClosed(['a1_event_identity_mismatch'], intakeResult);
  }

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
      runtimeVersion: A2_A1_S02_RUNTIME_VERSION,
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
    runtimeVersion: A2_A1_S02_RUNTIME_VERSION,
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
