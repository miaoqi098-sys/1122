# M1-A 实现任务包 V1

> 覆盖：R-GP-015、R-GP-016、R-GP-013
> 目标：把 TaskCenter、Policy/Permission、Approval 和目标切换审计拆成未来可实现的运行任务包。
> 边界：M1-A 不实现 Executor，不开放经营写权限。

## 任务包
1. TaskCenter运行任务包
2. PolicyPermission任务包
3. Approval工作流任务包
4. 目标切换审计任务包
5. M1-A集成验收

## 原则
- Task 是事实对象，不是 Agent 私有内存。
- Approval 是独立事实，不等于执行。
- Permission/Policy 在服务端 fail closed。
- 用户拒绝必须被记录并停止同方案自动重试。
- 任何可执行动作在 M1-B 前都只能形成计划/审批，不得真实写入平台。
