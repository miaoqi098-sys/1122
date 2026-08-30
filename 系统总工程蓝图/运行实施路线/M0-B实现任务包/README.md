# M0-B 实现任务包 V1

> 状态：规格化施工中
> 覆盖：R-GP-008～012、R-GP-014、R-GP-019、R-GP-020
> 目标：把状态、阶段、目标、事件、业务活动和记忆从静态 Contract 拆成未来可实现的运行任务包。

## 统一边界
- 输入只能来自 M0-A 标准事实对象和已确认业务规则。
- Event 继续复用 Agent-1 Canonical Event / ProcessedEvent，不建立第二套核心事件 Schema。
- BusinessState、ProductStage、Goal、Event、AgentActivity、Memory 必须保留版本、证据和时间。
- Agent 可以参与分析，但不能替代 Repository、状态机、规则版本或审计记录。
- 本阶段不实现 Agent Runtime、数据库或真实数据服务。

## 任务包
1. 状态阶段任务包
2. Goal生命周期任务包
3. Event与Signal任务包
4. Activity与Memory任务包
5. M0-B集成验收
