# Agent-1 任务调度

## 1. 模块定位
`任务调度/` 定义 Agent-1 在 FinalDecision 已形成后，任务如何被描述、依赖、审批、观察、失败、取消、回滚和进入验证。它是 S07 任务编排规则的静态治理层，不是真实 Scheduler 或 Executor。

## 2. 正式链路
```text
FinalDecision
→ S07 TaskOrchestration
→ TaskPlan / Task[] / TaskGraph
→ Scheduler / Approval / Executor
→ ExecutionResult
→ S08 ValidationResult
```

## 3. 与 S07 的边界
S07负责把FinalDecision拆成TaskPlan/TaskGraph，本模块规定这些任务对象和状态必须遵守的生命周期、依赖、审批、观察和异常规则。

本模块禁止重新选择Option、修改business_priority、重算风险或绕过FinalDecision.approval/required_controls。

## 4. 与共享层边界
- R07 Scheduler：未来真实定时、队列、唤醒、重试和状态推进。
- R08 Executor：未来真实执行API或人工动作。
- R09 ExecutionResultNormalizer：未来把执行结果统一为ExecutionResult。

Agent-1当前只定义任务框架、约束和预期状态，不假装任务已被真实执行。

## 5. TaskPlan 与 Task
TaskPlan至少保留：
- task_plan_id
- decision_id
- decision_item_id
- strategy_chain_id（适用时）
- tasks[]
- task_graph

Task至少可追溯：
- task_id
- task_plan_id
- decision_id
- decision_item_id
- scope
- task_type
- owner / executor / approver / validator
- status
- dependencies
- start/stop/success/rollback条件
- observation/validation要求

## 6. Task类型
- execution
- monitoring
- approval
- data_collection
- validation
- control
- rollback

## 7. 正式状态
```text
created
→ pending_approval
→ ready
→ running
├─ blocked
├─ failed
├─ cancelled
└─ awaiting_validation
       ↓
   completed
   rolled_back
```

并非所有任务都必须经过pending_approval；状态跳转必须满足任务类型和条件。

## 8. 核心原则
- `blocked` = 尚未满足执行条件；`failed` = 已尝试执行但失败。
- `completed` 只表示通过规定验证，不等于“Executor返回成功”立即完成。
- `eligible_with_controls` 的required_controls必须实体化为Task或条件。
- 任务依赖图必须检查循环、互斥和权限。
- 执行完成后必须进入验证链，不能把“动作已执行”当作“经营结果成功”。

## 9. 文件结构
- `任务生命周期.md`
- `任务依赖与TaskGraph.md`
- `审批节点.md`
- `观察窗口与验证.md`
- `失败取消与回滚.md`
- `共享调度与执行边界.md`
- `示例与验收.md`
- `总验收记录.md`

## 10. 当前阶段
当前只做框架静态定义；真实Scheduler、Executor、状态持久化、自动重试和任务队列属于系统运行/共享基础设施。