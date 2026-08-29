# Agent-1 工作流

## 1. 模块定位
`工作流/` 定义 Agent-1 从标准事件进入、完成决策、任务、执行验证到经验沉淀的端到端业务路由。它描述“各Skill和桥接组件如何串起来”，不实现真实Runner、Scheduler、Executor或数据库。

## 2. Canonical主链
```text
Event
→ S01 EventValidation
→ S02 ContextLoading / ContextPackage
→ S03 ConflictDetection
→ DecisionItemBuilder
→ S04 DecisionPrioritization
→ S05 OptionGeneration
→ S06 RiskAssessment
→ DecisionSelector
→ FinalDecision
→ S07 TaskOrchestration
→ Scheduler / Approval / Executor
→ ExecutionResultNormalizer
→ ExecutionResult
→ S08 OutcomeValidation
→ S09 LearningWriteback
→ LearningRecord / memory_writes plan
→ LearningWriteExecutor（未来）
```

S10 StrategyStabilization是横向控制，不是固定插在S09之后的第十步。

## 3. 桥接组件
- DecisionItemBuilder：把事件/上下文/冲突转成可排序DecisionItem。
- DecisionSelector：在Option和RiskAssessment中形成FinalDecision。
- ExecutionResultNormalizer：统一不同执行源回执。
- LearningWriteExecutor：未来真实写入S09 memory_writes。
- StrategyChainBuilder/持久化：维护策略链上下文，属于未来运行/记忆层。

## 4. 非正常路由
工作流必须允许：
- needs_information / request_more_evidence
- blocked
- request_approval_context / pending_approval
- send_to_S10 / hold_for_review
- regenerate_options
- execution failure
- data failure / premature evaluation
- rollback / new diagnosis / new decision

非正常路由不是异常“绕过”，而是正式工作流分支。

## 5. 状态与断点
每一步都应通过业务对象ID和运行trace恢复，不依赖聊天上下文。正式业务断点以event/decision/task/execution/validation/learning对象状态为准。

## 6. 运行边界
工作流只定义路由和业务条件；真实Skill调用由R01/R02，任务调度由R07，执行由R08，结果标准化由R09，学习写入由R10，策略链持久化由R11。

## 7. 文件结构
- `总控工作流.md`
- `S10横向控制.md`
- `桥接组件.md`
- `回路阻断与重入.md`
- `示例与验收.md`
- `总验收记录.md`

## 8. 核心原则
- 不使用固定经营指标优先顺序替代S04动态排序。
- 不绕过S01直接用脏Event。
- 不绕过DecisionSelector从S06直接下Task。
- 不把执行成功当经营结果成功。
- 不把S09 memory_writes计划当真实written。
- S10只在策略变化/稳定性场景介入，避免每次事件都机械调用。