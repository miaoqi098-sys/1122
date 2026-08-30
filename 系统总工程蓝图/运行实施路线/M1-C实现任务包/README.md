# M1-C 实现任务包 V1

> 覆盖：R-GP-023、R-GP-024、R-GP-026
> 目标：把真实Amazon只读/受控写连接、Agent Runtime、Scheduler/Queue 和单产品真实验收环境拆成未来实施规格。
> 边界：当前不读取或存储真实凭证，不接API，不部署Runtime，不执行真实经营动作。

## 任务包
1. 外部连接任务包
2. Agent Runtime任务包
3. Scheduler与Queue任务包
4. 真实MVP验收环境任务包
5. M1-C总验收

## 安全原则
- 凭证与Connector Profile分离。
- Amazon读取权限与写权限分离。
- Runtime不能绕过Policy/Permission/TaskCenter/Executor。
- Scheduler触发任务不等于自动获得执行权限。
- 真实验收从只读开始，再进入单一授权写动作。
- 所有成熟度声明必须符合 `真值等级与验收门禁.md`。
