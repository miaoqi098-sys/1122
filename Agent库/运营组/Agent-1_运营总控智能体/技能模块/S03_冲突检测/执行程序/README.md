# S03 执行程序

未来组件：`FactConflictDetector`、`GoalConflictDetector`、`TaskConflictDetector`、`AgentConflictDetector`、`ConflictClusterer`、`EvidenceResolver`。

实现顺序：先规则型事实/任务/约束冲突，再做语义型解释/策略冲突。

不得在本执行程序中做最终经营取舍；输出交给S04-S06和大脑。