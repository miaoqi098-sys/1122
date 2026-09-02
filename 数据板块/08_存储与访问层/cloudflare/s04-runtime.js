import {
  getS04ReadyDecisionItem,
  S04_INGRESS_CONTRACT_VERSION,
} from './s04-ingress.js';

export const S04_RUNTIME_CONTRACT_VERSION = 'S04-runtime-contract-v1.0.0';

function hold(decisionItemId, reason) {
  return {
    status: 'blocked',
    eligible: false,
    nextAction: 'hold_for_review',
    decisionItemId: decisionItemId || '',
    reasons: [reason],
    contractVersion: S04_RUNTIME_CONTRACT_VERSION,
    ingressContractVersion: S04_INGRESS_CONTRACT_VERSION,
  };
}

/**
 * Minimal S04 runtime boundary.
 *
 * Security contract:
 * - decision_item_id is the only caller-controlled authority accepted here.
 * - DecisionItem / Builder / S03 objects supplied by a caller are ignored.
 * - The authoritative chain is reloaded from CORE_DB by getS04ReadyDecisionItem().
 * - Any missing dependency, lookup failure, corrupt ledger, or lineage mismatch fails closed.
 * - This boundary performs no Amazon/listing/price/ads production write.
 */
export async function runS04Runtime(env, input = {}) {
  const decisionItemId = typeof input?.decision_item_id === 'string'
    ? input.decision_item_id.trim()
    : '';

  if (!decisionItemId) return hold('', 'missing_decision_item_id');
  if (!env?.CORE_DB || typeof env.CORE_DB.prepare !== 'function') {
    return hold(decisionItemId, 'database_unavailable');
  }

  try {
    const ingress = await getS04ReadyDecisionItem(env, decisionItemId);

    if (!ingress?.eligible || ingress.nextAction !== 'continue_to_S04') {
      return {
        status: 'blocked',
        eligible: false,
        nextAction: 'hold_for_review',
        decisionItemId,
        reasons: Array.isArray(ingress?.reasons) && ingress.reasons.length
          ? ingress.reasons
          : ['persisted_lineage_not_eligible'],
        contractVersion: S04_RUNTIME_CONTRACT_VERSION,
        ingressContractVersion: ingress?.contractVersion || S04_INGRESS_CONTRACT_VERSION,
      };
    }

    return {
      status: 'ready',
      eligible: true,
      nextAction: 'continue_to_S04',
      decisionItemId,
      builderRunId: ingress.builderRunId,
      conflictRunId: ingress.conflictRunId,
      eventId: ingress.eventId,
      decisionItem: ingress.decisionItem,
      reasons: [],
      contractVersion: S04_RUNTIME_CONTRACT_VERSION,
      ingressContractVersion: ingress.contractVersion,
    };
  } catch {
    return hold(decisionItemId, 'persisted_lineage_lookup_failed');
  }
}
