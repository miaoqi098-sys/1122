import { runAgent6ToDecisionItem } from './a6-a1-decision-item-runtime.js';
import {
  runS04Runtime,
  S04_RUNTIME_CONTRACT_VERSION,
} from './s04-runtime.js';

export const A6_A1_S04_RUNTIME_VERSION = 'A6-A1-S04-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'approvalGranted',
  'verifiedApprovalRecords',
  'taskAuthorized',
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'productionWriteAuthorized',
  'stateTransitionAuthorized',
  'finalDecision',
  'task',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function failClosed(reasons, decisionBridgeResult = null, s04Result = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A6_A1_S04_RUNTIME_VERSION,
    s04RuntimeVersion: S04_RUNTIME_CONTRACT_VERSION,
    decisionBridgeResult,
    s04Result,
    canonicalEvent: null,
    contextPackage: null,
    decisionItem: null,
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}

function syntheticPersistedRow(decisionBridgeResult) {
  const event = decisionBridgeResult.canonicalEvent;
  const item = decisionBridgeResult.decisionItems[0];
  const builderResult = decisionBridgeResult.builderResult;
  const s03Result = decisionBridgeResult.s03BridgeResult?.s03Result;

  const eventId = event.event_id;
  const builderRunId = builderResult.builder_id || `DIB:${eventId}:synthetic`;
  const conflictRunId = `S03:${eventId}:verified`;
  const contextRunId = `S02:${eventId}:verified`;
  const intakeId = `S01:${eventId}:verified`;
  const productId = event.product_id ?? null;
  const marketplace = event.metrics?.marketplace ?? event.marketplace ?? null;

  return {
    decision_item_id: item.decision_item_id,
    builder_run_id: builderRunId,
    conflict_run_id: conflictRunId,
    builder_conflict_run_id: conflictRunId,
    event_id: eventId,
    builder_event_id: eventId,
    conflict_event_id: eventId,
    builder_context_run_id: contextRunId,
    conflict_context_run_id: contextRunId,
    builder_intake_id: intakeId,
    conflict_intake_id: intakeId,
    decision_product_id: productId,
    builder_product_id: productId,
    conflict_product_id: productId,
    decision_marketplace: marketplace,
    builder_marketplace: marketplace,
    conflict_marketplace: marketplace,
    builder_input_json: JSON.stringify({
      scope: {
        scope_type: event.scope_type,
        scope_id: event.scope_id ?? event.product_id ?? null,
        product_id: productId,
        asin: event.asin ?? null,
      },
    }),
    builder_next_action: builderResult.next_action,
    s03_next_action: s03Result?.next_action,
    decision_item_json: JSON.stringify(item),
  };
}

function readOnlyDbFor(row) {
  return {
    prepare() {
      return {
        bind(decisionItemId) {
          return {
            async first() {
              if (decisionItemId !== row.decision_item_id) return null;
              return row;
            },
          };
        },
      };
    },
  };
}

function validateAgent6S04Lineage(input, decisionBridgeResult) {
  const reasons = [];
  const event = decisionBridgeResult?.canonicalEvent;
  const item = decisionBridgeResult?.decisionItems?.[0];
  const s03Result = decisionBridgeResult?.s03BridgeResult?.s03Result;

  if (!isObject(event)) return ['missing_agent6_canonical_event'];
  if (event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-6') {
    reasons.push('agent6_event_source_lineage_mismatch');
  }
  if (event.event_type !== 'MARGIN_COMPRESSION') {
    reasons.push('agent6_event_type_not_allowed_for_S04');
  }

  const expectedProductId = input?.scope?.product_id ?? null;
  const expectedScopeId = input?.scope?.scope_id ?? null;
  if (!nonEmptyString(expectedProductId)
      || event.product_id !== expectedProductId
      || event.scope_type !== 'product'
      || event.scope_id !== expectedScopeId) {
    reasons.push('agent6_product_scope_lineage_mismatch');
  }

  if (event.metrics?.product_id !== expectedProductId) {
    reasons.push('agent6_financial_product_metric_lineage_mismatch');
  }
  if (event.metrics?.baseline_window_id !== input?.baseline_window?.window_id
      || event.metrics?.current_window_id !== input?.current_window?.window_id) {
    reasons.push('agent6_financial_window_lineage_mismatch');
  }
  if (event.metrics?.cost_model_version !== input?.current_window?.cost_model_version
      || event.metrics?.currency !== input?.current_window?.currency) {
    reasons.push('agent6_financial_basis_lineage_mismatch');
  }

  if (!isObject(item)) {
    reasons.push('missing_decision_item');
  } else if (!Array.isArray(item.source_event_refs) || !item.source_event_refs.includes(event.event_id)) {
    reasons.push('decision_item_event_lineage_mismatch');
  }

  if (s03Result?.next_action !== 'continue_to_decision_item_builder'
      || s03Result?.event_id !== event.event_id
      || s03Result?.scope?.product_id !== event.product_id) {
    reasons.push('s03_not_verified_for_S04');
  }

  return reasons;
}

/**
 * Read-only Agent-6 bridge into the existing fail-closed S04 ingress/runtime.
 * Re-runs Agent-6 -> R16 -> S01 -> S02 -> S03 -> DecisionItemBuilder,
 * validates source/product/financial-window/cost-basis/event lineage, and
 * exposes only a synthetic read-only persistence view to S04. No D1 write,
 * approval, permission, task authorization, execution, dispatch, or
 * production write occurs.
 */
export async function runAgent6ToS04(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const decisionBridgeResult = runAgent6ToDecisionItem(input, options);
  if (decisionBridgeResult.status !== 'ready_for_S04' || decisionBridgeResult.nextAction !== 'continue_to_S04') {
    return {
      ...failClosed(decisionBridgeResult.reasons ?? ['agent6_decision_item_not_ready'], decisionBridgeResult),
      status: decisionBridgeResult.status,
      nextAction: decisionBridgeResult.nextAction,
      canonicalEvent: decisionBridgeResult.canonicalEvent ?? null,
      contextPackage: decisionBridgeResult.contextPackage ?? null,
    };
  }

  if (!Array.isArray(decisionBridgeResult.decisionItems) || decisionBridgeResult.decisionItems.length !== 1) {
    return failClosed(['unexpected_decision_item_count'], decisionBridgeResult);
  }

  const lineageReasons = validateAgent6S04Lineage(input, decisionBridgeResult);
  if (lineageReasons.length) return failClosed(lineageReasons, decisionBridgeResult);

  const event = decisionBridgeResult.canonicalEvent;
  const item = decisionBridgeResult.decisionItems[0];
  const row = syntheticPersistedRow(decisionBridgeResult);

  const s04Result = await runS04Runtime(
    { CORE_DB: readOnlyDbFor(row) },
    { decision_item_id: item.decision_item_id },
  );

  if (!isObject(s04Result)) return failClosed(['missing_s04_result'], decisionBridgeResult);
  if (!s04Result.eligible || s04Result.status !== 'ready' || s04Result.nextAction !== 'continue_to_S04') {
    return failClosed(
      Array.isArray(s04Result.reasons) && s04Result.reasons.length
        ? s04Result.reasons
        : ['s04_not_ready'],
      decisionBridgeResult,
      s04Result,
    );
  }
  if (s04Result.decisionItemId !== item.decision_item_id) {
    return failClosed(['s04_decision_item_lineage_mismatch'], decisionBridgeResult, s04Result);
  }
  if (s04Result.eventId !== event.event_id) {
    return failClosed(['s04_event_lineage_mismatch'], decisionBridgeResult, s04Result);
  }
  if (!Array.isArray(s04Result.decisionItem?.source_event_refs)
      || !s04Result.decisionItem.source_event_refs.includes(event.event_id)) {
    return failClosed(['s04_source_event_ref_mismatch'], decisionBridgeResult, s04Result);
  }

  return {
    status: 'ready_for_S04_decision_logic',
    nextAction: 'continue_to_S04_decision_logic',
    reasons: [],
    runtimeVersion: A6_A1_S04_RUNTIME_VERSION,
    s04RuntimeVersion: S04_RUNTIME_CONTRACT_VERSION,
    decisionBridgeResult,
    s04Result,
    canonicalEvent: event,
    contextPackage: decisionBridgeResult.contextPackage,
    decisionItem: s04Result.decisionItem,
    readOnly: true,
    approvalGranted: false,
    permissionGranted: false,
    taskAuthorized: false,
    executionAuthorized: false,
    dispatchAuthorized: false,
    productionWriteAuthorized: false,
  };
}
