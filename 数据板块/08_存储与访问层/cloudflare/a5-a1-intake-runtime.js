import { runAgent5TrafficSignal } from './a5-traffic-runtime.js';
import { validateS01, S01_VALIDATOR_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S01_事件校验/执行程序/runtime.js';

export const A5_A1_INTAKE_RUNTIME_VERSION = 'A5-A1-intake-runtime-v1.0.0';
const PRIVILEGE_KEYS = new Set(['executionAuthorized','dispatchAuthorized','permissionGranted','stateTransitionAuthorized','productionWriteAuthorized','approvalGranted','taskAuthorized','finalDecision','task']);
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const text = (v) => typeof v === 'string' && v.trim().length > 0;
function failClosed(reasons, agent5Result = null, s01Result = null) {
  return { status:'blocked', nextAction:'hold_for_review', reasons:[...new Set(reasons)], runtimeVersion:A5_A1_INTAKE_RUNTIME_VERSION, validatorVersion:S01_VALIDATOR_VERSION, agent5Result, s01Result, canonicalEvent:null, readOnly:true, approvalGranted:false, permissionGranted:false, taskAuthorized:false, executionAuthorized:false, dispatchAuthorized:false, productionWriteAuthorized:false };
}

export function runAgent5ToA1Intake(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_bridge_input']);
  for (const key of PRIVILEGE_KEYS) if (Object.prototype.hasOwnProperty.call(input, key)) return failClosed([`privilege_injection_${key}`]);

  const agent5Result = runAgent5TrafficSignal(input, { receivedAt: options.receivedAt, mappedAt: options.mappedAt, generatedAt: options.generatedAt });
  if (agent5Result.status !== 'event_and_response_ready') return { ...failClosed(agent5Result.reasons ?? ['agent5_not_ready'], agent5Result), status: agent5Result.status, nextAction: agent5Result.nextAction };

  const normalized = agent5Result.normalizedEvent;
  const event = normalized?.canonicalEvent;
  if (!normalized || normalized.status !== 'normalized' || !event) return failClosed(['missing_verified_r16_canonical_event'], agent5Result);
  if (normalized.nextAction !== 'continue_to_A1_event_intake') return failClosed(['r16_route_not_allowed_for_a1_intake'], agent5Result);
  if (event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-5') return failClosed(['canonical_source_lineage_mismatch'], agent5Result);
  if (event.event_type !== 'traffic_session_decline') return failClosed(['canonical_event_type_not_allowed'], agent5Result);

  const productId = input.scope?.product_id ?? null;
  if (!text(productId) || event.product_id !== productId) return failClosed(['canonical_product_lineage_mismatch'], agent5Result);
  if (event.scope_type !== 'product' || event.scope_id !== input.scope?.scope_id) return failClosed(['canonical_scope_lineage_mismatch'], agent5Result);
  if (event.metrics?.product_id !== productId) return failClosed(['canonical_traffic_product_metric_lineage_mismatch'], agent5Result);
  if (event.metrics?.baseline_window_id !== input.baseline_window?.window_id || event.metrics?.current_window_id !== input.current_window?.window_id) return failClosed(['canonical_traffic_window_lineage_mismatch'], agent5Result);

  const s01Result = validateS01({ event, known_product_ids: Array.isArray(options.knownProductIds) ? options.knownProductIds : [productId], existing_events: Array.isArray(options.existingEvents) ? options.existingEvents : [], current_time: options.currentTime ?? event.received_at ?? event.occurred_at, allowed_sources: ['professional_agent','Agent-5'] });
  if (!['passed','passed_with_warnings'].includes(s01Result.status)) return { ...failClosed(['a1_s01_intake_not_ready', ...(s01Result.blocking_errors ?? []).map(x=>x.code)], agent5Result, s01Result), nextAction: s01Result.next_action === 'request_information' ? 'request_information' : 'hold_for_review' };
  if (s01Result.next_action !== 'continue_to_S02' || !s01Result.normalized_event) return failClosed(['a1_s01_route_not_allowed'], agent5Result, s01Result);
  if (s01Result.normalized_event.event_id !== event.event_id || s01Result.normalized_event.source_agent !== 'Agent-5' || s01Result.normalized_event.product_id !== productId) return failClosed(['a1_s01_lineage_mismatch'], agent5Result, s01Result);

  return { status:'ready_for_S02', nextAction:'continue_to_S02', reasons:[], runtimeVersion:A5_A1_INTAKE_RUNTIME_VERSION, validatorVersion:S01_VALIDATOR_VERSION, agent5Result, s01Result, canonicalEvent:s01Result.normalized_event, readOnly:true, approvalGranted:false, permissionGranted:false, taskAuthorized:false, executionAuthorized:false, dispatchAuthorized:false, productionWriteAuthorized:false };
}
