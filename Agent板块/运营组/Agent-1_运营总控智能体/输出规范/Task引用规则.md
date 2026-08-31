# FinalDecision 到 TaskPlan / Task 引用规则

## 1. 正式关系
FinalDecision 不内嵌最终 Task 列表。S07 接收 `scope + final_decision` 后生成：
- task_plan_id
- decision_id
- decision_item_id
- strategy_chain_id（适用时）
- tasks[]
- task_graph

## 2. 主引用链
```text
event_id
→ decision_item_id
→ option_id
→ decision_id
→ task_plan_id
→ task_id
```

每个 Task 至少应能回溯到 decision_id / decision_item_id，并尽量保留 option_id 或 source_action_id。

## 3. required_controls
FinalDecision 中的 required_controls 若存在，S07 必须将其实体化为 control / approval / monitoring / rollback 等任务或条件。控制措施未落实时，eligible_with_controls 方案不得进入 ready 执行状态。

## 4. 审批
FinalDecision.approval.required=true 时，S07 必须生成或关联审批任务/条件；审批未通过前相关执行Task不得ready。

## 5. 策略替代
存在 strategy_chain_id / supersedes_decision_id 时，S07 可以生成旧任务处置计划，但不得删除历史引用。

## 6. 禁止
- FinalDecision 直接写死最终执行顺序；
- 输出规范绕过 S07 自己生成 Task DAG；
- Task 修改 business_priority 或重新选择 Option；
- required_controls 在 Task 编排时被丢弃。