# Agent-1 输出规范

## 1. 模块定位

`输出规范/` 定义 Agent-1 最终决策输出如何被下游 S07、审批、调度、执行与验证链消费，并保证所有输出可追溯、可阻断、可降级。

本模块不重新执行 DecisionSelector，不自行拆 Task，也不真实执行经营动作。

## 2. Canonical 输出链

```text
DecisionSelector.output
↓
FinalDecision
↓
S07 TaskOrchestration
↓
TaskPlan / Task[] / TaskGraph
↓
调度 / 审批 / 执行
↓
ExecutionResult
↓
S08 ValidationResult
```

## 3. 核心输出对象

### FinalDecision
Agent-1 唯一正式经营决策对象。至少保留：
- decision_id
- decision_item_id
- scope
- business_priority
- selected_option
- risk_assessment
- decision_basis
- approval
- strategy_chain_id（适用时）
- decision_confidence
- created_at / valid_until / review_trigger

### DecisionSelector 路由
输出不一定都能进入执行。`next_action` 支持：
- continue_to_S07
- send_to_S10
- request_more_evidence
- regenerate_options
- request_approval_context
- hold_for_review

### TaskPlan / Task
Task 不属于 FinalDecision 内嵌字段。FinalDecision 形成后，由 S07 生成 task_plan_id、tasks[] 与 task_graph。

## 4. 作用域

正式输出使用统一 `scope`，支持 product / parent_product / sku / account / store / global / campaign / ad_group / keyword / task / decision 等作用域；不再强制所有决策绑定 product_id。

## 5. 追溯主链

```text
event_id
→ decision_item_id
→ option_id
→ decision_id
→ task_plan_id
→ task_id
→ execution_result_id
→ validation_id
→ learning_id
```

`strategy_chain_id` 横跨策略生命周期；`run_id / trace_id` 属于运行调用追踪，不替代业务主键。

## 6. 与 S07 的边界

- DecisionSelector：选择最终 Option，形成 FinalDecision。
- 输出规范：规定 FinalDecision 如何稳定表达和路由。
- S07：把 FinalDecision 拆成 TaskPlan/TaskGraph。
- Scheduler/Executor：未来真实调度与执行。

禁止在 FinalDecision 内预先生成最终 Task 数组，避免绕过 S07 的 control、approval、dependency 和 DAG 逻辑。

## 7. 旧 `决策指令.schema.json`

该文件属于早期输出格式。当前保留用于兼容和迁移说明，但不再作为 canonical 输出Schema。新的正式Schema为 `FinalDecision.schema.json`。

## 8. 当前阶段

当前只完成输出对象、路由、审批/阻断、追溯和静态验收。真实 DecisionSelector、审批系统、Scheduler、Executor、状态持久化仍属于运行层。