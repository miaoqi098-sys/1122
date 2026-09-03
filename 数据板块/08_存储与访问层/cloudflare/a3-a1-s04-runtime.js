import { runAgent3ToDecisionItem } from './a3-a1-decision-item-runtime.js';
import {
  runS04Runtime,
  S04_RUNTIME_CONTRACT_VERSION,
} from './s04-runtime.js';

export const A3_A1_S04_RUNTIME_VERSION = 'A3-A1-S04-runtime-v1.0.0';

const PRIVILEGE_KEYS = new Set([
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
    runtimeVersion: A3_A1_S04_RUNTIME_VERSION,
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
  const marketplace = event.metrics?.marketplace ?? null;

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

function validateAgent3S04Lineage(input, decisionBridgeResult) {
  const reasons = [];
  const event = decisionBridgeResult?.canonicalEvent;
  const item = decisionBridgeResult?.decisionItems?.[0];
  const s03Result = decisionBridgeResult?.s03BridgeResult?.s03Result;

  if (!isObject(event)) return ['missing_agent3_canonical_event'];
  if (event.source_type !== 'professional_agent' || event.source_agent !== 'Agent-3') {
    reasons.push('agent3_event_source_lineage_mismatch');
  }
  if (event.event_type !== 'competitor_price_shift') {
    reasons.push('agent3_event_type_not_allowed_for_S04');
  }

  const expectedProductId = input?.our_scope?.product_id ?? null;
  const expectedScopeId = input?.our_scope?.scope_id ?? null;
  if (!nonEmptyString(expectedProductId)
      || event.product_id !== expectedProductId
      || event.scope_type !== 'product'
      || event.scope_id !== expectedScopeId) {
    reasons.push('agent3_product_scope_lineage_mismatch');
  }

  const current = input?.current_snapshot;
  const baseline = input?.baseline_snapshot;
  const competitorId = current?.competitor_entity_id ?? null;
  if (!nonEmptyString(competitorId)
      || event.metrics?.competitor_entity_id !== competitorId
      || event.metrics?.relationship_type !== 'direct_competitor'
      || event.metrics?.baseline_snapshot_id !== baseline?.snapshot_id
      || event.metrics?.current_snapshot_id !== current?.snapshot_id) {
    reasons.push('agent3_competitor_lineage_mismatch');
  }

  if (!isObject(item)) {
    reasons.push('missing_decision_item');
  } else {
    if (!Array.isArray(item.source_event_refs) || !item.source_event_refs.includes(event.event_id)) {
      reasons.push('decision_item_event_lineage_mismatch');
    }
    if (item.scope?.scope_type !== event.scope_type
        || item.scope?.scope_id !== (event.scope_id ?? event.product_id ?? null)
        || item.scope?.product_id !== event.product_id) {
      reasons.push('decision_item_scope_lineage_mismatch');
    }
  }

  if (s03Result?.next_action !== 'continue_to_decision_item_builder'
      || s03Result?.event_id !== event.event_id
      || s03Result?.scope?.product_id !== event.product_id) {
    reasons.push('s03_not_verified_for_S04');
  }

  return reasons;
}

/**
 * Read-only Agent-3 bridge into the existing fail-closed S04 ingress/runtime.
 *
 * The bridge re-runs Agent-3 -> R16 -> S01 -> S02 -> S03 -> DecisionItemBuilder,
 * validates source/product/competitor/snapshot/DecisionItem lineage, and then exposes
 * only a synthetic read-only persistence view to S04. It performs no D1 write and
 * grants no approval, permission, execution, dispatch, or production-write authority.
 */
export async function runAgent3ToS04(input, options = {}) {
  if (!isObject(input)) return failClosed(['invalid_runtime_input']);

  for (const key of PRIVILEGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return failClosed([`privilege_injection_${key}`]);
    }
  }

  const decisionBridgeResult = runAgent3ToDecisionItem(input, options);
  if (decisionBridgeResult.status !== 'ready_for_S04' || decisionBridgeResult.nextAction !== 'continue_to_S04') {
    return {
      status: decisionBridgeResult.status,
      nextAction: decisionBridgeResult.nextAction,
      reasons: decisionBridgeResult.reasons ?? [],
      runtimeVersion: A3_A1_S04_RUNTIME_VERSION,
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

  const lineageReasons = validateAgent3S04Lineage(input, decisionBridgeResult);
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
  if (s04Result.decisionItem?.scope?.product_id !== event.product_id) {
    return failClosed(['s04_product_lineage_mismatch'], decisionBridgeResult, s04Result);
  }

  return {
    status: 'ready_for_S04_decision_logic',
    nextAction: 'continue_to_S04_decision_logic',
    reasons: [],
    runtimeVersion: A3_A1_S04_RUNTIME_VERSION,
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
