# Agent Runtime 实现任务包 V1

> 覆盖：R-GP-024（Runtime部分）

## 1. 目标
让专业Agent与Agent-1真实消费结构化输入、调用Skill/Tool并产出结构化业务对象，同时不越过Task/Policy/Executor边界。

## 2. Runtime最小职责
- agent registry / version；
- run_id；
- context loader；
- structured input validation；
- Skill/Tool registry；
- output schema validation；
- timeout/cancel；
- retry policy；
- error classification；
- run trace与业务对象引用；
- token/model/provider配置与版本记录。

## 3. Agent-1边界
Agent-1继续是唯一最终经营决策出口，但：
- 不直接持久化Task事实；
- 不直接绕过Permission；
- 不直接调用Amazon写API；
- FinalDecision必须结构化落地后交TaskCenter。

## 4. 专业Agent边界
Agent-2～13负责专业分析与建议；通过公共协议交接Event/Response。不得形成跨域最终经营决策替代Agent-1。

## 5. 私有推理与审计
系统只保存：输入引用、结构化输出、业务理由摘要、证据refs、运行状态、错误信息。不得把私有链式思考作为业务日志或Memory保存。

## 6. fail-closed
- 输入Schema不合法 → reject run
- context关键事实缺失 → insufficient_context
- Tool权限不足 → stop/escalate，不伪造结果
- 输出不符合Schema → validation_failed
- 重试超过上限 → failed并交调度/人工处理

## 7. 验收条件
- 相同run可追溯agent/model/prompt/config版本；
- Agent输出可被下游Schema消费；
- Runtime不能直接制造未经Task/Policy的执行副作用；
- 失败重试幂等，不重复创建同义Task/Decision；
- 具备机器证据后才可声明AGENT_RUNTIME_VERIFIED。

## 8. 静态L1
Agent Runtime输入输出、版本、错误和权限边界已明确。未部署Runtime。L1：PASS。