import { validateS01, S01_VALIDATOR_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S01_事件校验/执行程序/runtime.js';
import { buildDefaultContextRequest } from './s02-context.js';
import { planContextDomains, runS02, S02_RUNTIME_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S02_上下文装载/执行程序/runtime.js';
import { runS03, S03_RUNTIME_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/S03_冲突检测/执行程序/runtime.js';
import { runDecisionItemBuilder, DECISION_ITEM_BUILDER_RUNTIME_VERSION } from '../../../Agent板块/运营组/Agent-1_运营总控智能体/技能模块/统一接口/执行程序/decision-item-builder.runtime.js';
import { runS04Runtime, S04_RUNTIME_CONTRACT_VERSION } from './s04-runtime.js';
import { buildS04PriorityCandidate, S04_PRIORITY_CONTRACT_VERSION } from './s04-priority.js';
import { rankS04PriorityCandidates, S04_PRIORITY_POLICY_VERSION } from './s04-priority-policy.js';
import { formS04DecisionCandidates, S04_DECISION_FORMATION_VERSION } from './s04-decision-formation.js';
import { generateS04TaskDrafts, S04_TASK_DRAFT_VERSION } from './s04-task-draft.js';
import { createS04ApprovalRequests, S04_APPROVAL_GATE_VERSION } from './s04-approval-gate.js';
import { createS04PermissionDecisions, S04_PERMISSION_DECISION_VERSION } from './s04-permission-decision.js';

export const PROFESSIONAL_AGENT_FULL_READONLY_CHAIN_VERSION='professional-agent-full-readonly-chain-v1.0.1';
const isObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.trim().length>0;
function blocked(reasons,stage='bridge',details={}){return{status:'blocked',nextAction:'hold_for_review',stage,reasons:[...new Set(reasons)],runtimeVersion:PROFESSIONAL_AGENT_FULL_READONLY_CHAIN_VERSION,...details,readOnly:true,approvalGranted:false,permissionGranted:false,taskAuthorized:false,executionAuthorized:false,dispatchAuthorized:false,productionWriteAuthorized:false};}
function readOnlyDbFor(row){return{prepare(){return{bind(id){return{async first(){return id===row.decision_item_id?row:null;}};}};}};}
function syntheticRow(event,item,builder,s03){const id=event.event_id,p=event.product_id??null,m=event.metrics?.marketplace??event.marketplace??null,cr=`S03:${id}:verified`,xr=`S02:${id}:verified`,ir=`S01:${id}:verified`;return{decision_item_id:item.decision_item_id,builder_run_id:builder.builder_id||`DIB:${id}:synthetic`,conflict_run_id:cr,builder_conflict_run_id:cr,event_id:id,builder_event_id:id,conflict_event_id:id,builder_context_run_id:xr,conflict_context_run_id:xr,builder_intake_id:ir,conflict_intake_id:ir,decision_product_id:p,builder_product_id:p,conflict_product_id:p,decision_marketplace:m,builder_marketplace:m,conflict_marketplace:m,builder_input_json:JSON.stringify({scope:{scope_type:event.scope_type,scope_id:event.scope_id??p,product_id:p,asin:event.asin??null}}),builder_next_action:builder.next_action,s03_next_action:s03?.next_action,decision_item_json:JSON.stringify(item)};}

export async function runProfessionalAgentFullReadonlyChain(config){
  if(!isObject(config))return blocked(['invalid_chain_config']);
  const {agentId,eventType,domainResult,domainEvent,input,options={}}=config;
  if(!text(agentId)||!text(eventType)||!isObject(domainResult)||!isObject(input)||!isObject(input.scope))return blocked(['invalid_chain_config']);
  if(domainResult.status!=='event_and_response_ready')return{...blocked(domainResult.reasons??['domain_runtime_not_ready'],'domain',{domainResult}),status:domainResult.status,nextAction:domainResult.nextAction};
  if(domainResult.readOnly!==true||domainResult.approvalGranted!==false||domainResult.permissionGranted!==false||domainResult.taskAuthorized!==false||domainResult.executionAuthorized!==false||domainResult.dispatchAuthorized!==false||domainResult.productionWriteAuthorized!==false)return blocked(['domain_runtime_privilege_mismatch'],'domain',{domainResult});
  const normalized=domainResult.normalizedEvent,event=normalized?.canonicalEvent;
  if(normalized?.status!=='normalized'||normalized?.nextAction!=='continue_to_A1_event_intake'||!isObject(event))return blocked(['missing_verified_r16_event'],'r16',{domainResult});
  if(event.source_type!=='professional_agent'||event.source_agent!==agentId||event.event_type!==eventType)return blocked(['r16_source_or_event_lineage_mismatch'],'r16',{domainResult});
  if(!text(event.scope_type)||event.scope_type!==input.scope.scope_type||(event.scope_id??null)!==(input.scope.scope_id??null))return blocked(['r16_scope_lineage_mismatch'],'r16',{domainResult});
  if(text(event.product_id)&&event.product_id!==input.scope?.product_id)return blocked(['r16_product_lineage_mismatch'],'r16',{domainResult});
  if(isObject(domainEvent)&&text(domainEvent.event_id)&&(event.event_id!==domainEvent.event_id||event.source_ref!==domainEvent.event_id))return blocked(['domain_event_identity_lineage_mismatch'],'r16',{domainResult});
  if(typeof config.validateLineage==='function'){const lr=config.validateLineage(event,input,domainResult);if(Array.isArray(lr)&&lr.length)return blocked(lr,'domain_lineage',{domainResult});}

  const knownIds=Array.isArray(options.knownProductIds)?options.knownProductIds:(text(event.product_id)?[event.product_id]:[]);
  const s01=validateS01({event,known_product_ids:knownIds,existing_events:Array.isArray(options.existingEvents)?options.existingEvents:[],current_time:options.currentTime??event.received_at??event.occurred_at,allowed_sources:['professional_agent',agentId]});
  if(!['passed','passed_with_warnings'].includes(s01.status)||s01.next_action!=='continue_to_S02'||s01.normalized_event?.event_id!==event.event_id)return blocked(['s01_not_ready',...(s01.blocking_errors??[]).map(x=>x.code)],'S01',{domainResult,s01});

  if(!isObject(options.availableContext))return blocked(['missing_available_context'],'S02',{domainResult,s01});
  const req={...buildDefaultContextRequest(s01.normalized_event),...(isObject(options.contextRequest)?options.contextRequest:{})};
  const plannedDomains=planContextDomains(s01.normalized_event,req);
  const s02=runS02({validated_event:s01.normalized_event,s01_validation:{status:s01.status,warnings:s01.warnings??[],duplicate_signal:s01.duplicate_signal??{},validation_summary:s01.validation_summary??null,validator_version:s01.validator_version??null},context_request:req,available_context:options.availableContext,current_time:options.currentTime??event.received_at??event.occurred_at});
  if(!isObject(s02))return blocked(['missing_s02_result'],'S02',{domainResult,s01});
  if(s02.status==='needs_information')return{...blocked((s02.missing_context??[]).map(x=>`missing:${x.domain??'unknown'}`),'S02',{domainResult,s01,s02}),status:'needs_information',nextAction:s02.next_action==='refresh_context'?'refresh_context':'request_information'};
  if(!['ready','ready_with_gaps'].includes(s02.status)||s02.next_action!=='continue_analysis'||!isObject(s02.context_package))return blocked(['s02_not_ready'],'S02',{domainResult,s01,s02});
  if(text(event.product_id)){
    const pi=s02.context_package.C01_product_identity;
    if(!isObject(pi)||pi.product_id!==event.product_id||(text(event.asin)&&pi.asin!==event.asin))return blocked(['s02_product_identity_context_mismatch'],'S02',{domainResult,s01,s02});
  }
  if(typeof config.validateContext==='function'){const cr=config.validateContext(s02.context_package,event,input,s02);if(Array.isArray(cr)&&cr.length)return blocked(cr,'S02',{domainResult,s01,s02});}

  const contextPackage=s02.context_package,contextRefs=Array.isArray(s02.context_refs)?s02.context_refs:[];
  const commonScope={scope_type:event.scope_type,scope_id:event.scope_id??event.product_id??null,product_id:event.product_id??null,asin:event.asin??null};
  const s03=runS03({event_id:event.event_id,scope:commonScope,context_package:contextPackage,context_refs:contextRefs,normalized_elements:Array.isArray(options.normalizedElements)?options.normalizedElements:undefined,current_time:options.currentTime??event.received_at??event.occurred_at});
  if(!isObject(s03)||s03.event_id!==event.event_id||s03.next_action!=='continue_to_decision_item_builder')return blocked(['s03_not_ready'],'S03',{domainResult,s01,s02,s03});
  if(s03.scope?.scope_type!==event.scope_type||(s03.scope?.scope_id??null)!==(commonScope.scope_id??null))return blocked(['s03_scope_lineage_mismatch'],'S03',{domainResult,s01,s02,s03});

  const builder=runDecisionItemBuilder({scope:commonScope,source_event_refs:[event.event_id],context_package:contextPackage,context_refs:contextRefs,conflicts:Array.isArray(s03.conflicts)?s03.conflicts:[],conflict_groups:Array.isArray(s03.conflict_groups)?s03.conflict_groups:[],s03_next_action:s03.next_action,current_time:options.currentTime??event.received_at??event.occurred_at});
  if(!isObject(builder)||builder.runtime_version!==DECISION_ITEM_BUILDER_RUNTIME_VERSION)return blocked(['builder_runtime_mismatch'],'DecisionItemBuilder',{domainResult,s01,s02,s03,builder});
  if(builder.next_action!=='continue_to_S04')return{...blocked(builder.builder_notes??['builder_not_ready'],'DecisionItemBuilder',{domainResult,s01,s02,s03,builder}),status:builder.next_action==='request_more_context'?'needs_information':'blocked',nextAction:builder.next_action==='request_more_context'?'request_more_context':'hold_for_review'};
  if(!Array.isArray(builder.decision_items)||builder.decision_items.length!==1)return blocked(['unexpected_decision_item_count'],'DecisionItemBuilder',{domainResult,s01,s02,s03,builder});
  const item=builder.decision_items[0];if(!item.source_event_refs?.includes(event.event_id))return blocked(['decision_item_lineage_mismatch'],'DecisionItemBuilder',{domainResult,s01,s02,s03,builder});

  const s04=await runS04Runtime({CORE_DB:readOnlyDbFor(syntheticRow(event,item,builder,s03))},{decision_item_id:item.decision_item_id});
  if(!isObject(s04)||!s04.eligible||s04.status!=='ready'||s04.nextAction!=='continue_to_S04'||s04.eventId!==event.event_id||s04.decisionItemId!==item.decision_item_id)return blocked(['s04_not_ready'],'S04',{domainResult,s01,s02,s03,builder,s04});
  const pc=buildS04PriorityCandidate(s04);if(pc.status!=='candidate_ready'||pc.rankingEligible!==true||pc.nextAction!=='continue_to_priority_policy')return blocked(['priority_candidate_not_ready'],'Priority',{domainResult,s01,s02,s03,builder,s04,pc});
  const pr=rankS04PriorityCandidates([pc]);if(pr.status!=='ranking_ready'||pr.rankingEligible!==true||pr.nextAction!=='continue_to_decision_formation'||pr.rankedDecisionItems?.length!==1)return blocked(['priority_policy_not_ready'],'PriorityPolicy',{domainResult,s01,s02,s03,builder,s04,pc,pr});
  const formation=formS04DecisionCandidates(pr);if(formation.status!=='formation_ready'||formation.formationEligible!==true||formation.nextAction!=='continue_to_task_draft_generation'||formation.decisionCandidates?.length!==1)return blocked(['decision_formation_not_ready'],'DecisionFormation',{domainResult,s01,s02,s03,builder,s04,pc,pr,formation});
  const candidate=formation.decisionCandidates[0];if(candidate.readOnly!==true||candidate.executionAuthorized!==false||candidate.taskGenerationMode!=='draft_only'||candidate.eventId!==event.event_id)return blocked(['decision_candidate_contract_mismatch'],'DecisionFormation',{domainResult,s01,s02,s03,builder,s04,pc,pr,formation});
  const tasks=generateS04TaskDrafts(formation);if(tasks.status!=='task_drafts_ready'||tasks.taskDraftEligible!==true||tasks.nextAction!=='continue_to_approval_gate'||tasks.taskDrafts?.length!==1)return blocked(['task_draft_not_ready'],'TaskDraft',{domainResult,s01,s02,s03,builder,s04,pc,pr,formation,tasks});
  const task=tasks.taskDrafts[0];if(task.taskState!=='draft'||task.readOnly!==true||task.executionAuthorized!==false||task.approvalRequired!==true||task.dispatchAuthorized!==false||task.eventId!==event.event_id)return blocked(['task_draft_contract_mismatch'],'TaskDraft',{domainResult,s01,s02,s03,builder,s04,pc,pr,formation,tasks});
  const approvals=createS04ApprovalRequests(tasks);if(approvals.status!=='approval_pending'||approvals.approvalGateEligible!==true||approvals.nextAction!=='await_human_approval'||approvals.approvalRequests?.length!==1)return blocked(['approval_gate_not_ready'],'ApprovalGate',{domainResult,s01,s02,s03,builder,s04,pc,pr,formation,tasks,approvals});
  const approval=approvals.approvalRequests[0];if(approval.approvalStatus!=='pending'||approval.humanApprovalRequired!==true||approval.readOnly!==true||approval.executionAuthorized!==false||approval.permissionGranted!==false)return blocked(['approval_request_contract_mismatch'],'ApprovalGate',{domainResult,s01,s02,s03,builder,s04,pc,pr,formation,tasks,approvals});
  const permission=createS04PermissionDecisions(approvals,[]);if(permission.status!=='blocked'||permission.permissionDecisionEligible!==false||permission.nextAction!=='hold_for_review'||!permission.reasons?.includes('approval_record_count_mismatch')||permission.permissionDecisions?.length!==0||permission.executionAuthorized!==false||permission.dispatchAuthorized!==false)return blocked(['permission_boundary_fail_closed_contract_mismatch'],'PermissionBoundary',{domainResult,s01,s02,s03,builder,s04,pc,pr,formation,tasks,approvals,permission});
  return{status:'approval_pending',nextAction:'await_verified_human_approval',stage:'PermissionBoundary',reasons:['verified_human_approval_required'],runtimeVersion:PROFESSIONAL_AGENT_FULL_READONLY_CHAIN_VERSION,versions:{s01:S01_VALIDATOR_VERSION,s02:S02_RUNTIME_VERSION,s03:S03_RUNTIME_VERSION,builder:DECISION_ITEM_BUILDER_RUNTIME_VERSION,s04:S04_RUNTIME_CONTRACT_VERSION,priority:S04_PRIORITY_CONTRACT_VERSION,priorityPolicy:S04_PRIORITY_POLICY_VERSION,decisionFormation:S04_DECISION_FORMATION_VERSION,taskDraft:S04_TASK_DRAFT_VERSION,approval:S04_APPROVAL_GATE_VERSION,permission:S04_PERMISSION_DECISION_VERSION},plannedDomains,domainResult,canonicalEvent:event,s01,s02,s03,builder,s04,priorityCandidate:pc,priorityResult:pr,formation,taskDraftResult:tasks,approvalGateResult:approvals,permissionDecisionResult:permission,decisionItem:item,decisionCandidate:candidate,taskDraft:task,approvalRequest:approval,permissionDecision:null,readOnly:true,approvalGranted:false,permissionGranted:false,taskAuthorized:false,executionAuthorized:false,dispatchAuthorized:false,productionWriteAuthorized:false};
}
