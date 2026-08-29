# S01-S10 输入输出映射 V1.1

## 总链路
```text
Event
↓
S01 EventValidation
↓ normalized_event + s01_validation
S02 ContextLoading
↓ ContextPackage
S03 ConflictDetection
↓ Conflict[] / ConflictGroup[]
DecisionItemBuilder
↓ Canonical DecisionItem[]
S04 DecisionPrioritization
↓ Ranked DecisionItem[]
S05 OptionGeneration
↓ Option[]
S06 RiskAssessment
↓ RiskAssessment[]
DecisionSelector
↓ FinalDecision
S07 TaskOrchestration
↓ TaskPlan / Task[] / TaskGraph
调度 / 审批 / 执行
↓ ExecutionResult
S08 OutcomeValidation
↓ ValidationResult
S09 LearningWriteback
↓ LearningRecord[] / MemoryWritePlan
记忆与数据层

S10 StrategyStabilization：任何“可能改变正在运行策略的新动作”出现时横向介入。
```

## S01 → S02
S02正式输入：
- `validated_event` = `S01.normalized_event`
- `s01_validation.status`
- `s01_validation.warnings`
- `s01_validation.duplicate_signal`

禁止重新使用未经S01标准化的原始event。

作用域统一：
- product / parent_product / sku：必须有product_id；
- account / store / global：product_id允许null；
- 作用对象通过scope_type/scope_id/scope_objects表达。

## S02 → S03
`S02.context_package` 是唯一权威上下文事实源。

S03输入：
- event_id
- scope
- context_package
- context_refs（可选）
- normalized_elements（派生视图，可选）

已取消把`current_goals`、`business_state`、`constraints`、`agent_analyses`作为并列第二事实源的正式接口。

## S03 → DecisionItemBuilder
S03正常非阻断结果：
`next_action = continue_to_decision_item_builder`

DecisionItemBuilder输入：
- Event引用；
- ContextPackage；
- S03 conflicts/conflict_groups；
- 状态与目标均从ContextPackage读取。

输出必须符合`DecisionItem.schema.json`。

## DecisionItemBuilder → S04
正式字段：
- decision_item_id
- item_type
- subject
- problem_definition
- objective
- goal_layer
- urgency
- conflict_refs / constraint_refs / evidence_refs / source_event_refs / context_refs

`item_id`、`problem`不再属于新接口。

## S04 → S05
S04排序结果必须保留：
- decision_item_id
- problem_definition
- objective
- business_priority
- goal_layer
- priority_basis
- conflict_refs / constraint_refs / evidence_refs

S05直接消费上述对象，不由Runner补写problem/objective，也不得自行改变business_priority。

## S05 → S06
S05 `options[]` 原样进入S06。

S06只能追加风险信息，不得静默改写：
- option_id
- actions
- assumptions
- success_criteria
- stop_conditions

S06上下文只从ContextPackage读取。

## S06 → DecisionSelector
S06正常完成：
`next_action = continue_to_decision_selector`

DecisionSelector接收：
- Ranked DecisionItem；
- S05 Options；
- S06 RiskAssessments；
- ContextPackage；
- 当前StrategyChain/Task上下文（如有）。

输出必须符合`FinalDecision.schema.json`。

禁止S06直接宣布最终方案。

## FinalDecision → S07
S07正式顶层输入：
- scope
- final_decision
- active_tasks / capabilities / permissions / resource_capacity（运行条件）

`final_decision`内部至少包括：
- decision_id
- decision_item_id
- business_priority
- selected_option
- selected_option对应risk_assessment
- decision_basis
- approval
- strategy_chain_id（如有）

S07不得再接受散装selected_option/risk_assessment作为正式顶层接口，也不得重新选择方案。

## S07 → Execution Layer
S07输出：
- task_plan_id
- decision_id
- decision_item_id
- strategy_chain_id
- Task[]
- TaskGraph

每个Task必须可追溯：
`decision_item_id → decision_id → option_id/source_action_id → task_plan_id → task_id`

## Execution Layer → S08
执行器必须把工具/API结果标准化为`ExecutionResult`。

正式字段至少：
- execution_result_id
- task_id
- task_plan_id
- decision_id
- decision_item_id
- option_id（如有）
- strategy_chain_id（如有）
- requested_action
- actual_action
- execution_status
- executor

`actual_execution`不再属于新S08接口。

## S08 → S09
S08生成正式`ValidationResult`，至少：
- validation_id
- execution_result_id
- task_id
- decision_id
- decision_item_id
- execution_status
- business_outcome_status
- overall_validation_status
- observation_window_status
- data_quality
- attribution_status
- failure_type
- confidence
- decision_implication

S09正式输入名为`validation_result`。
`verification_result`不再属于新接口。

## S09 → Memory Layer
S09输出：
- learning_batch_id
- validation_id
- fact_records
- interpretation_records
- learning_items
- knowledge_candidates
- memory_writes plan

LearningItem引用链至少保留：
- source_decision_id
- source_decision_item_id
- source_task_ids
- source_execution_result_ids
- source_validation_ids

S09的memory_writes只允许`planned / queued / failed`；真实`written`状态必须由记忆与数据层返回。

## S10横向介入
S10输入使用统一scope和StrategyChain。

当新动作可能改变正在运行策略：
```text
新Event / 新Option / 新Decision proposal
↓
S03（如需确认strategy conflict）
↓
S10
```

输出：
- stabilization_id
- strategy_chain_id
- allow / hold / merge / escalate / override
- hold_gate / override_record

- hold：不得建立反向执行任务；
- merge：更新现有StrategyChain；
- allow：继续正常决策链；
- override：保留旧decision/task引用并交S07重新编排；
- escalate：进入审批/复核。

## 正式主键引用链
```text
event_id
↓
decision_item_id
↓
option_id
↓
decision_id
↓
task_plan_id
↓
task_id
↓
execution_result_id
↓
validation_id
↓
learning_id
```

`strategy_chain_id`横向贯穿决策、任务、验证与S10。

## 最重要原则
任何相邻Skill之间都不允许靠Prompt“猜”字段关系；新接口不得继续新增旧别名。兼容旧历史数据由未来Adapter负责，不污染Canonical Schema。