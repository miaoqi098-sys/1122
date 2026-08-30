# TaskCenter V0

> 状态：静态框架施工中
> 定位：全系统任务生命周期与人工任务查询中枢，不属于任何单一 Agent 私有模块。

## 1. 输入对象
- Task
- Approval
- HumanActionRequest
- FinalDecision 引用
- Policy / Permission 结果
- ExecutionResult / ValidationResult 回写

## 2. 核心职责
1. 承载 Task 生命周期与状态查询；
2. 维护 Task 与 Approval / HumanActionRequest 的引用关系；
3. 提供“今日需要我处理”的统一人工任务读模型；
4. 向执行层提供已满足审批/权限条件的可执行任务引用；
5. 接收执行/验证结果并更新任务状态；
6. 保留任务历史，不把任务运行逻辑塞回 Agent-1。

## 3. 不负责
- 不重新选择经营方案；
- 不替代 Agent-1 FinalDecision；
- 不绕过 Policy/Permission；
- 不直接实现真实 Scheduler/Executor；
- 不把 Task completed 自动解释为 Goal achieved 或 Event resolved。

## 4. 与 Agent-1 边界
```text
Agent-1 FinalDecision
        ↓
S07 TaskOrchestration
        ↓
TaskPlan / Task
        ↓
TaskCenter
        ↓
Approval / HumanActionRequest / ReadyTask
        ↓
Scheduler / Executor（未来运行层）
        ↓
ExecutionResult / ValidationResult
        ↓
TaskCenter 状态回写
```

Agent-1 决定“为什么做、做什么、任务如何编排”；TaskCenter 决定“这些任务如何被系统保存、查询、等待、审批、交给执行层并跟踪状态”。

## 5. V0 输出
- `HumanTaskView`：首页“今日需要我处理”。
- `TaskDetailView`：任务详情。
- `ExecutableTaskRef`：未来交给 Scheduler/Executor 的受控引用。
- 产品级当前任务查询：供 ProductStateAggregator 使用。

## 6. 文件
- `HumanTaskView.schema.json`
- `ExecutableTaskRef.schema.json`
- `规则/TaskCenter状态与接口规则.md`
- `测试/TaskCenterV0静态验收.md`

## 7. 运行边界
V0 只定义 Contract/读模型/接口边界；不实现数据库、队列、调度器、审批UI动作或 Executor。