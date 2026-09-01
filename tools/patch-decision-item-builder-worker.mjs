import fs from 'node:fs';

const path = '数据板块/08_存储与访问层/cloudflare/worker.js';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error(`Patch anchor not found: ${label}`);
  const count = s.split(from).length - 1;
  if (count !== 1) throw new Error(`Patch anchor count ${count} != 1: ${label}`);
  s = s.replace(from, to);
}

replaceOnce(
`import {
  detectConflictsForContextRun,
  detectConflictsForEvent,
  detectPendingConflicts,
  A1_CONFLICT_DETECTOR_VERSION,
} from './s03-conflict.js';
import { S02_RUNTIME_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S02_上下文装载/执行程序/runtime.js';
import { S03_RUNTIME_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S03_冲突检测/执行程序/runtime.js';`,
`import {
  detectConflictsForContextRun,
  detectConflictsForEvent,
  detectPendingConflicts,
  A1_CONFLICT_DETECTOR_VERSION,
} from './s03-conflict.js';
import {
  buildDecisionItemsForConflictRun,
  buildDecisionItemsForEvent,
  buildPendingDecisionItems,
  A1_DECISION_ITEM_BUILDER_VERSION,
} from './decision-item-builder.js';
import { S02_RUNTIME_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S02_上下文装载/执行程序/runtime.js';
import { S03_RUNTIME_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S03_冲突检测/执行程序/runtime.js';
import { DECISION_ITEM_BUILDER_RUNTIME_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/统一接口/执行程序/decision-item-builder.runtime.js';`,
'import builder dependencies');

replaceOnce(
`        (SELECT COUNT(*) FROM a1_conflict_runs WHERE s03_status IN ('needs_evidence','blocked')) AS a1_conflict_gated,
        (SELECT COUNT(*) FROM decisions) AS decisions,`,
`        (SELECT COUNT(*) FROM a1_conflict_runs WHERE s03_status IN ('needs_evidence','blocked')) AS a1_conflict_gated,
        (SELECT COUNT(*) FROM a1_decision_item_builder_runs) AS a1_builder_runs,
        (SELECT COUNT(*) FROM a1_decision_item_builder_runs WHERE next_action='continue_to_S04') AS a1_builder_ready,
        (SELECT COUNT(*) FROM a1_decision_items) AS a1_decision_items,
        (SELECT COUNT(*) FROM decisions) AS decisions,`,
'summary SQL');

replaceOnce(
`      a1ConflictGated: Number(row?.a1_conflict_gated || 0),
      decisions: Number(row?.decisions || 0),`,
`      a1ConflictGated: Number(row?.a1_conflict_gated || 0),
      a1DecisionItemBuilderRuns: Number(row?.a1_builder_runs || 0),
      a1DecisionItemBuilderReady: Number(row?.a1_builder_ready || 0),
      a1DecisionItems: Number(row?.a1_decision_items || 0),
      decisions: Number(row?.decisions || 0),`,
'summary output');

replaceOnce(
`async function runS03Pending(env, limit = 10) {
  return detectPendingConflicts(env, { limit: Math.min(Math.max(Number(limit || 10), 1), 10) });
}
`,
`async function runS03Pending(env, limit = 10) {
  return detectPendingConflicts(env, { limit: Math.min(Math.max(Number(limit || 10), 1), 10) });
}

async function runDecisionItemBuilderPending(env, limit = 10) {
  return buildPendingDecisionItems(env, { limit: Math.min(Math.max(Number(limit || 10), 1), 10) });
}
`,
'pending helper');

replaceOnce(
`        a1Conflict: {
          version: A1_CONFLICT_DETECTOR_VERSION,
          runtimeVersion: S03_RUNTIME_VERSION,
          pipeline: ['S02ContextPackage', 'ConflictElementNormalizer', 'ConflictDetection', 'ConflictClusterer', 'EvidenceResolver', 'A1ConflictLedger'],
          contextPackageIsUniqueFactSource: true,
          automaticAfterS02: true,
          directToS04: false,
          normalNextAction: 'continue_to_decision_item_builder',
          outputs: ['clear', 'conflicts_found', 'needs_evidence', 'blocked'],
        },
        summary,`,
`        a1Conflict: {
          version: A1_CONFLICT_DETECTOR_VERSION,
          runtimeVersion: S03_RUNTIME_VERSION,
          pipeline: ['S02ContextPackage', 'ConflictElementNormalizer', 'ConflictDetection', 'ConflictClusterer', 'EvidenceResolver', 'A1ConflictLedger'],
          contextPackageIsUniqueFactSource: true,
          automaticAfterS02: true,
          directToS04: false,
          normalNextAction: 'continue_to_decision_item_builder',
          outputs: ['clear', 'conflicts_found', 'needs_evidence', 'blocked'],
        },
        a1DecisionItems: {
          version: A1_DECISION_ITEM_BUILDER_VERSION,
          runtimeVersion: DECISION_ITEM_BUILDER_RUNTIME_VERSION,
          pipeline: ['S03ConflictResult', 'DecisionItemBuilder', 'CanonicalDecisionItem', 'A1DecisionItemLedger'],
          contextPackageIsUniqueFactSource: true,
          automaticAfterS03: true,
          builderDoesNotRank: true,
          normalNextAction: 'continue_to_S04',
          outputs: ['continue_to_S04', 'request_more_context', 'hold_for_review'],
        },
        summary,`,
'status builder');

replaceOnce(
`        const a1Conflict = await runS03Pending(env, 10);
        return json({ success: true, ...result, a1Intake, a1Context, a1Conflict }, 200, origin);`,
`        const a1Conflict = await runS03Pending(env, 10);
        const a1DecisionItems = await runDecisionItemBuilderPending(env, 10);
        return json({ success: true, ...result, a1Intake, a1Context, a1Conflict, a1DecisionItems }, 200, origin);`,
'rebuild bridge');

replaceOnce(
`        const s03Conflict = s02Context?.found ? await detectConflictsForEvent(env, eventId) : null;
        return json({ success: true, ...result, s02Context, s03Conflict }, 200, origin);`,
`        const s03Conflict = s02Context?.found ? await detectConflictsForEvent(env, eventId) : null;
        const decisionItems = s03Conflict?.nextAction === 'continue_to_decision_item_builder'
          ? await buildDecisionItemsForEvent(env, eventId)
          : null;
        return json({ success: true, ...result, s02Context, s03Conflict, decisionItems }, 200, origin);`,
'intake event bridge');

replaceOnce(
`        const s03Conflict = await runS03Pending(env, Math.min(limit, 10));
        return json({ success: true, ...result, s02Context, s03Conflict }, 200, origin);`,
`        const s03Conflict = await runS03Pending(env, Math.min(limit, 10));
        const decisionItems = await runDecisionItemBuilderPending(env, Math.min(limit, 10));
        return json({ success: true, ...result, s02Context, s03Conflict, decisionItems }, 200, origin);`,
'intake pending bridge');

replaceOnce(
`        const s03Conflict = await detectConflictsForEvent(env, eventId);
        return json({ success: true, ...result, s03Conflict }, 200, origin);`,
`        const s03Conflict = await detectConflictsForEvent(env, eventId);
        const decisionItems = s03Conflict?.nextAction === 'continue_to_decision_item_builder'
          ? await buildDecisionItemsForEvent(env, eventId)
          : null;
        return json({ success: true, ...result, s03Conflict, decisionItems }, 200, origin);`,
'context event bridge');

replaceOnce(
`        const s03Conflict = await runS03Pending(env, limit);
        return json({ success: true, ...result, s03Conflict }, 200, origin);`,
`        const s03Conflict = await runS03Pending(env, limit);
        const decisionItems = await runDecisionItemBuilderPending(env, limit);
        return json({ success: true, ...result, s03Conflict, decisionItems }, 200, origin);`,
'context pending bridge');

replaceOnce(
`        if (!result.found) return json({ success: false, message: 'S02 ContextRun not found', contextRunId }, 404, origin);
        return json({ success: true, ...result }, 200, origin);`,
`        if (!result.found) return json({ success: false, message: 'S02 ContextRun not found', contextRunId }, 404, origin);
        const decisionItems = result.nextAction === 'continue_to_decision_item_builder'
          ? await buildDecisionItemsForConflictRun(env, result.conflictRunId)
          : null;
        return json({ success: true, ...result, decisionItems }, 200, origin);`,
'conflict context bridge');

replaceOnce(
`        if (!result.found) return json({ success: false, message: 'No ready S02 ContextPackage found for event', eventId }, 404, origin);
        return json({ success: true, ...result }, 200, origin);`,
`        if (!result.found) return json({ success: false, message: 'No ready S02 ContextPackage found for event', eventId }, 404, origin);
        const decisionItems = result.nextAction === 'continue_to_decision_item_builder'
          ? await buildDecisionItemsForEvent(env, eventId)
          : null;
        return json({ success: true, ...result, decisionItems }, 200, origin);`,
'conflict event bridge');

replaceOnce(
`        const result = await detectPendingConflicts(env, { limit });
        return json({ success: true, ...result }, 200, origin);`,
`        const result = await detectPendingConflicts(env, { limit });
        const decisionItems = await runDecisionItemBuilderPending(env, limit);
        return json({ success: true, ...result, decisionItems }, 200, origin);`,
'conflict pending bridge');

replaceOnce(
`    return json({ success: false, message: 'Endpoint not found' }, 404, origin);`,
`    if (request.method === 'POST' && url.pathname === '/internal/a1/decision-items-conflict') {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: 'Unauthorized' }, 401, origin);
      if (!env.CORE_DB) return json({ success: false, message: 'CORE_DB is not configured' }, 503, origin);
      const body = await parseBody(request);
      const conflictRunId = String(body?.conflict_run_id || url.searchParams.get('conflict_run_id') || '').trim();
      if (!conflictRunId) return json({ success: false, message: 'conflict_run_id is required' }, 400, origin);
      try {
        const result = await buildDecisionItemsForConflictRun(env, conflictRunId, { builderPolicy: body?.builder_policy || undefined });
        if (!result.found) return json({ success: false, message: 'S03 ConflictRun not found', conflictRunId }, 404, origin);
        return json({ success: true, ...result }, 200, origin);
      } catch (error) {
        return json({ success: false, message: 'DecisionItemBuilder failed', error: error.message }, 500, origin);
      }
    }

    if (request.method === 'POST' && url.pathname === '/internal/a1/decision-items-event') {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: 'Unauthorized' }, 401, origin);
      if (!env.CORE_DB) return json({ success: false, message: 'CORE_DB is not configured' }, 503, origin);
      const body = await parseBody(request);
      const eventId = String(body?.event_id || url.searchParams.get('event_id') || '').trim();
      if (!eventId) return json({ success: false, message: 'event_id is required' }, 400, origin);
      try {
        const result = await buildDecisionItemsForEvent(env, eventId, { builderPolicy: body?.builder_policy || undefined });
        if (!result.found) return json({ success: false, message: 'No eligible S03 ConflictRun found for event', eventId }, 404, origin);
        return json({ success: true, ...result }, 200, origin);
      } catch (error) {
        return json({ success: false, message: 'DecisionItemBuilder event build failed', error: error.message }, 500, origin);
      }
    }

    if (request.method === 'POST' && url.pathname === '/internal/a1/decision-items-pending') {
      if (!isInternalAuthorized(request, env)) return json({ success: false, message: 'Unauthorized' }, 401, origin);
      if (!env.CORE_DB) return json({ success: false, message: 'CORE_DB is not configured' }, 503, origin);
      try {
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 10), 1), 10);
        const result = await buildPendingDecisionItems(env, { limit });
        return json({ success: true, ...result }, 200, origin);
      } catch (error) {
        return json({ success: false, message: 'DecisionItemBuilder pending build failed', error: error.message }, 500, origin);
      }
    }

    return json({ success: false, message: 'Endpoint not found' }, 404, origin);`,
'builder endpoints');

s = s.replace('// deploy marker: s03-conflict-v1.0', '// deploy marker: decision-item-builder-v1.0');
fs.writeFileSync(path, s);
console.log('DecisionItemBuilder worker patch applied.');
