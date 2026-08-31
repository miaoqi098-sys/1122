# S07｜任务编排

## 技能定位
S07把Agent-1已经形成的`FinalDecision`转换成可执行、可审批、可监控、可回滚、可验证的任务网络（Task Plan / Task DAG）。

S07负责“把最终决策组织成任务”，不负责选择方案、不负责重新评估风险，也不直接调用API执行。

## 正式调用位置
```text
S05 Options
+
S06 RiskAssessments
↓
DecisionSelector
↓
FinalDecision
↓
S07 TaskOrchestration
↓
TaskPlan / Task[] / TaskGraph
↓
调度 / 审批 / 执行层
↓
ExecutionResult
↓
S08
```

## 正式输入
S07顶层正式业务输入为：
- `scope`
- `final_decision`

FinalDecision至少包含：
- decision_id
- decision_item_id
- business_priority
- selected_option
- selected_option对应risk_assessment
- decision_basis
- approval
- strategy_chain_id（如有）

S07不再正式接收散装`selected_option + risk_assessment`并自行拼成决策。

## Task Plan
每次编排生成：
- `task_plan_id`
- decision_id
- decision_item_id
- strategy_chain_id（如有）
- tasks[]
- task_graph

## 每个Task核心引用
每个任务至少可追溯：
```text
decision_item_id
↓
decision_id
↓
option_id / source_action_id
↓
task_plan_id
↓
task_id
```

正式作用域使用`scope`，不再把单独product_id视为所有任务唯一作用域模型。

## 任务类型
- execution
- monitoring
- approval
- data_collection
- validation
- control
- rollback

## 角色拆分
- owner：业务责任方
- executor：真实执行方
- approver：审批方
- validator：验证方

四者不得混成一个owner。

## 风险控制实体化
S06 / FinalDecision中的`required_controls`不能停留在文字里，S07必须转成一个或多个：
- control task
- start_condition
- stop_condition
- monitoring task
- approval task
- rollback task

`eligible_with_controls`的方案在控制措施未落实前不得进入ready执行状态。

## Task DAG
支持：
- depends_on
- blocks
- parallel_with
- mutex_with

必须检查循环依赖、互斥冲突、权限和执行能力。

## 生命周期
```text
created
↓
pending_approval
↓
ready
↓
running
├─ blocked
├─ failed
├─ cancelled
└─ awaiting_validation
       ↓
   completed
   rolled_back
```

`blocked`表示尚未满足执行条件；`failed`表示已尝试执行但失败。

## 与DecisionSelector边界
DecisionSelector决定“选哪个方案”。
S07只决定“这个已选方案怎样拆成任务网络”。

S07禁止：
- 自行换Option；
- 修改S04 business_priority；
- 重算S06风险；
- 绕过FinalDecision审批要求。

## 与调度/执行层边界
S07不直接：
- 运行定时器；
- 调Amazon API；
- 执行失败重试；
- 长期维护任务状态；
- 假装API执行成功。

## 当前版本
- 业务规则：V1.1；
- 接口：V1.2，已统一为FinalDecision→TaskPlan/Task引用链；
- 执行程序：待系统运行层实现TaskDecomposer、ControlMaterializer、RoleResolver、TaskGraphBuilder和DependencyValidator。