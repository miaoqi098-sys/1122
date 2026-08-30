# Scheduler 与 Queue 实现任务包 V1

> 覆盖：R-GP-024（调度部分）

## 1. 职责
- 定时/事件触发Agent run；
- 任务排队与优先级；
- 幂等键；
- retry/backoff；
- dead-letter；
- concurrency limit；
- cancellation；
- run/task correlation。

## 2. 边界
Scheduler只决定“什么时候运行什么”，不决定经营动作是否允许执行。
Queue只承载工作项，不成为TaskCenter业务任务事实库。

## 3. 防重复
同一 event_id + agent_id + processing_version 应具有稳定dedup语义；重放不能无限生成FinalDecision/Task。

## 4. 失败路径
- transient error → bounded retry
- permanent validation error → dead-letter / human review
- dependency unavailable → waiting_external
- repeated failure → circuit break

## 5. 验收条件
- Scheduler重启不丢失可恢复任务；
- 重试不产生重复业务对象；
- 高优先级不会绕过权限；
- Queue积压、失败和延迟可监控；
- 调度触发与业务Task状态明确分离。

## 6. 静态L1
调度、队列、幂等和业务边界已明确。未实现Scheduler/Queue。L1：PASS。