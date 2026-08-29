# S01-S10 输入输出映射

## 总链路
```text
Event
↓
S01
↓ normalized_event
S02
↓ ContextPackage
S03
↓ Conflict[]
DecisionItemBuilder
↓ DecisionItem[]
S04
↓ Ranked DecisionItem[]
S05
↓ Option[]
S06
↓ RiskAssessment[]
DecisionSelector
↓ FinalDecision
S07
↓ Task[] / TaskGraph
调度/审批/执行
↓ ExecutionResult
S08
↓ ValidationResult
S09
↓ LearningItem[] / MemoryWritePlan
记忆与数据层

S10：任何“可能改变正在运行策略的新动作”出现时横向介入。
```

## S01 → S02
### S01主输出
- `normalized_event`
- `status`
- `warnings`
- `duplicate_signal`

### S02正式输入
`validated_event` 必须等于 `S01.normalized_event`，不得重新使用未经标准化的原始event。

若S01：
- passed / passed_with_warnings → 可进入S02；
- needs_information → 先补信息；
- rejected → 不进入S02。

S01 warnings应随Invocation Envelope保留，S02不需要重复判断事件是否合法。

## S02 → S03
S03的唯一主上下文源：`S02.context_package`。

S03可接收：
- current_goals
- active_tasks
- agent_analyses
- hard_constraints

但这些只能由ContextPackage派生，并保留对应C03/C07/C10引用。

禁止：运行器从其他地方再加载一套不同值覆盖ContextPackage。

## S03 → DecisionItemBuilder → S04
S03不直接输出DecisionItem。

DecisionItemBuilder输入：
- S01 Event
- S02 ContextPackage
- S03 conflicts/conflict_groups
- 当前business state
- 当前goals

输出标准 `DecisionItem[]`。

映射原则：
- `DecisionItem.decision_item_id` 是唯一字段名；
- S04内部旧 `item_id` 视为兼容别名，后续统一；
- `problem_definition` 必须来自事件/状态/冲突综合，不得只复制某个Agent recommendation；
- `objective` 来自当前目标系统；
- conflict_refs必须指向S03 conflict_id。

## S04 → S05
S05接收S04排序后的DecisionItem。

标准映射：
- `decision_item_id` ← S04 item_id/未来decision_item_id
- `business_priority` ← S04 business_priority
- `problem_definition` ← 原始DecisionItem.problem_definition
- `objective` ← 原始DecisionItem.objective
- `goal_layer` ← S04 goal_layer
- `priority_basis` ← S04 priority_basis
- `conflict_refs` / `constraint_refs` 保留

S04只改变排序信息，不得丢失原DecisionItem的问题定义与目标。

## S05 → S06
S05 `options[]` 原样进入S06 `options[]`。

S06不得静默改写：
- option_id
- actions
- assumptions
- success_criteria
- stop_conditions

S06只能追加风险解释、控制要求、eligibility和审批要求。

## S06 → DecisionSelector
DecisionSelector同时接收：
- ranked DecisionItem
- S05 options
- S06 option_risks
- current goals
- business state
- constraints
- conflicts
- active strategy/task context

输出FinalDecision。

禁止：S06直接宣布“最终选择方案”。

## FinalDecision → S07
S07正式消费：
- decision_id
- product/scope
- selected_option
- selected_option对应的risk_assessment
- business_priority
- approvals/constraints

S07不得重新选择其他Option，也不得改变S04业务优先级。

## S07 → Execution Layer → S08
S07输出Task / TaskGraph。

执行层必须返回标准ExecutionResult，至少包括：
- execution_result_id
- task_id
- execution_status
- actual_action
- started_at
- finished_at
- executor
- logs/errors
- observed_state_change（如可确认）

S08不能直接把API响应当作ExecutionResult。

## S08 → S09
S09.verification_result 必须直接映射S08 ValidationResult，不得摘要后丢失：
- execution_status
- business_outcome_status
- overall_validation_status
- criteria_results
- observation_window_status
- data_quality
- attribution_status
- confounders
- failure_type
- confidence
- decision_implication

## S09 → Memory Layer
S09只输出：
- fact_records
- interpretation_records
- learning_items
- knowledge_candidates
- memory_writes plan

实际写库状态由记忆与数据层返回，不由S09自行宣称成功。

## S10横向调用位置
当新建议/新动作可能影响已存在strategy_chain时：
```text
新Event/新Option/新Decision proposal
↓
S03识别strategy conflict（如有）
↓
S10判断 allow/hold/merge/escalate/override
```

- hold/merge → 不建立新的反向S07执行链；
- allow → 正常进入DecisionSelector/S07；
- override → 形成override_record，再进入S07重新编排旧任务与新任务；
- escalate → 进入审批/复核；
- 证据冲突无法判断 → 回S03/S02。

## 最重要原则
任何相邻Skill之间都不允许“靠提示词大概理解”完成字段转换。所有转换必须在映射或canonical schema中有明确规则。