# TaskCenter 运行任务包 V1

> 覆盖：R-GP-015

## 1. Repository职责
持久化 Task、HumanActionRequest、Approval引用，支持按 product/user/status/priority/deadline 查询。

## 2. 状态机
必须由事务状态机执行合法迁移，禁止前端/Agent直接写任意status。
最低覆盖：created、queued、in_progress、waiting_human、waiting_external、approved、rejected、executing、validating、completed、cancelled、failed、expired。

## 3. 依赖关系
支持 blocked_by / depends_on / parent_task / task_plan 引用；依赖未满足时禁止进入 executing。

## 4. 人工任务查询
首页 HumanTaskView 只能由结构化 Task + HumanActionRequest + Approval状态派生。

## 5. 幂等与并发
- create task 需要稳定 dedup key；
- 状态迁移使用版本/乐观锁；
- 同一审批请求不得重复消费；
- expired/rejected task 不得被旧事件重新激活，除非显式 reopen/new task。

## 6. 审计
每次迁移保存：from、to、actor、at、reason、source_ref、version。

## 7. 验收条件
- 非法迁移被拒绝；
- 两个并发审批不能产生双执行授权；
- waiting_human能稳定映射首页；
- Task终态与Event状态相互独立；
- Agent-1任务调度逻辑通过系统TaskCenter落地，而非维护第二份私有任务事实。

## 8. 静态L1
TaskCenter Repository、状态机、并发、依赖和审计边界已明确。L1：PASS。