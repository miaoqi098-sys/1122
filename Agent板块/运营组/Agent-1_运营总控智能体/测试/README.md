# Agent-1 测试

## 1. 模块定位
`测试/` 用于验证 Agent-1 框架在当前静态阶段是否结构一致、对象闭合、边界清楚，并为未来动态运行测试保留正式挂账。

本模块严格区分：
- 静态框架测试：当前可执行/可判定；
- 动态运行测试：需要Runner、Scheduler、Executor、API、数据库或真实事件流，当前只能挂账。

## 2. 静态测试范围
- canonical对象链引用是否一致；
- scope语义是否统一；
- 决策/任务/执行/验证/学习边界；
- S10策略稳定性横向介入；
- needs_information/blocked/approval/hold/retry等异常路径；
- deprecated对象是否仍被新模块错误引用；
- 旧固定优先级、固定Lx审批是否重新出现；
- README与实际文件是否一致；
- 示例、Schema、规则之间是否冲突。

## 3. 动态测试范围
- Skill Runner真实调用；
- Agent Runner上下文装载；
- Schema Validator运行校验；
- Scheduler/Executor状态推进；
- Amazon API真实数据/动作；
- ExecutionResultNormalizer；
- LearningWriteExecutor；
- StrategyChain持久化；
- 断点恢复、并发、幂等、重试。

这些当前不得标记“通过”。

## 4. 测试结果语义
- PASS：当前范围有真实静态证据支持。
- FAIL：当前框架存在明确冲突/缺口。
- BLOCKED_RUNTIME：需要未来运行能力，当前不判通过。
- NOT_APPLICABLE：当前对象/场景不适用。

## 5. 文件
- `验收测试.md`
- `跨模块接口测试.md`
- `异常路径测试.md`
- `回归兼容测试.md`
- `运行测试挂账.md`
- `总验收记录.md`

## 6. 禁止
- 把未运行的动态测试写成PASS；
- 用旧测试要求推翻当前canonical规则；
- 测试只写“应该如此”却不指向正式文件/对象证据；
- 将运行层缺失误判为Agent框架失败。