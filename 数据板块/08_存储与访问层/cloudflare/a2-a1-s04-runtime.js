import { runAgent2ToDecisionItem } from './a2-a1-decision-item-runtime.js';
import {
  runS04Runtime,
  S04_RUNTIME_CONTRACT_VERSION,
} from './s04-runtime.js';

export const A2_A1_S04_RUNTIME_VERSION = 'A2-A1-S04-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
  'executionAuthorized',
  'dispatchAuthorized',
  'permissionGranted',
  'productionWriteAuthorized',
]);

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function failClosed(reasons, decisionBridgeResult = null, s04Result = null) {
  return {
    status: 'blocked',
    nextAction: 'hold_for_review',
    reasons: [...new Set(reasons)],
    runtimeVersion: A2_A1_S04_RUNTIME_VERSION,
    s04RuntimeVersion: S04_RUNTIME_CONTRACT_VERSION,
    decisionBridgeResult,
    s04Result,
    canonicalEvent: null,
    contextPackage: null,
    decisionItem: null,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
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
  const marketplace = null;

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

/**
 * Agent-2 read-only bridge into the existing S04 persisted-lineage boundary.
 *
 * This bridge deliberately uses a synthetic read-only persistence view for contract
 * verification. It does not write D1 and does not grant execution/dispatch authority.
 * The S04 ingress/runtime still re-validates the full lineage before returning ready.
 */
export async function runAgent2ToS04(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const decisionBridgeResult = runAgent2ToDecisionItem(input, options);
  if (decisionBridgeResult.status !== 'ready_for_S04' || decisionBridgeResult.nextAction !== 'continue_to_S04') {
    return {
      status: decisionBridgeResult.status,
      nextAction: decisionBridgeResult.nextAction,
      reasons: decisionBridgeResult.reasons ?? [],
      runtimeVersion: A2_A1_S04_RUNTIME_VERSION,
      s04RuntimeVersion: S04_RUNTIME_CONTRACT_VERSION,
      decisionBridgeResult,
      s04Result: null,
      canonicalEvent: decisionBridgeResult.canonicalEvent ?? null,
      contextPackage: decisionBridgeResult.contextPackage ?? null,
      decisionItem: null,
      readOnly: true,
      executionAuthorized: false,
      dispatchAuthorized: false,
    };
  }

  if (!Array.isArray(decisionBridgeResult.decisionItems) || decisionBridgeResult.decisionItems.length !== 1) {
    return failClosed(['unexpected_decision_item_count'], decisionBridgeResult);
  }

  const event = decisionBridgeResult.canonicalEvent;
  const item = decisionBridgeResult.decisionItems[0];
  const s03Result = decisionBridgeResult.s03BridgeResult?.s03Result;
  if (!isObject(event) || event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-2') {
    return failClosed(['agent2_event_lineage_mismatch'], decisionBridgeResult);
  }
  if (!Array.isArray(item.source_event_refs) || !item.source_event_refs.includes(event.event_id)) {
    return failClosed(['decision_item_event_lineage_mismatch'], decisionBridgeResult);
  }
  if (s03Result?.next_action !== 'continue_to_decision_item_builder') {
    return failClosed(['s03_not_verified_for_S04'], decisionBridgeResult);
  }

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

  return {
    status: 'ready_for_S04_decision_logic',
    nextAction: 'continue_to_S04_decision_logic',
    reasons: [],
    runtimeVersion: A2_A1_S04_RUNTIME_VERSION,
    s04RuntimeVersion: S04_RUNTIME_CONTRACT_VERSION,
    decisionBridgeResult,
    s04Result,
    canonicalEvent: event,
    contextPackage: decisionBridgeResult.contextPackage,
    decisionItem: s04Result.decisionItem,
    readOnly: true,
    executionAuthorized: false,
    dispatchAuthorized: false,
  };
}
