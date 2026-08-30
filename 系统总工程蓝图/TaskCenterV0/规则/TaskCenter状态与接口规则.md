# TaskCenter 状态与接口规则 V0

## 1. TaskCenter 是公共运行中枢
TaskCenter 只承载和查询系统级 Task/Approval/HumanActionRequest，不拥有经营方案选择权。

## 2. 写入来源
允许写入/推进 TaskCenter 的业务来源：
- Agent-1 S07 任务编排产生 TaskPlan/Task；
- Policy/Permission 产生控制结果；
- 人工产生 Approval / HumanActionRequest 处理结果；
- ExecutionResult / ValidationResult 回写任务状态。

专业 Agent 不得绕过 Agent-1 直接写跨域最终执行 Task；领域内部分析任务未来可单独定义，不混入本 V0。

## 3. 人工任务视图
HumanTaskView 是读模型，不是新的事实对象。其数据必须可追溯 Task + HumanActionRequest + Approval。

首页只展示仍需人工介入的请求：
- task.status=pending_approval / waiting_human；或
- requires_human=true 且对应 HumanActionRequest 未解决。

## 4. 可执行任务出口
TaskCenter 只有在以下条件满足后才允许生成 ExecutableTaskRef：
- Task 处于 ready；
- 所有依赖已满足；
- permission_status=allowed；
- approval_status=not_required 或 approved；
- required_controls 已满足；
- 未过期/未取消/未阻塞。

ExecutableTaskRef 只是交接引用，不表示已执行。

## 5. 状态回写
- ExecutionResult.success：Task 默认进入 awaiting_validation，而不是 completed。
- ValidationResult通过后，Task 才可 completed。
- 执行失败：进入 failed 或根据未来重试策略回到 ready/blocked；不得静默重试。
- Approval rejected/expired：不得生成 ExecutableTaskRef。

## 6. 查询接口语义
V0至少支持逻辑查询：
- `get_task(task_id)`
- `list_product_open_tasks(product_id)`
- `list_human_tasks(status, priority, product_id)`
- `get_approval(approval_id)`
- `get_human_action_request(id)`
- `list_ready_tasks()`

这里只定义语义，不实现 API/数据库。

## 7. 审计
所有状态变更未来必须记录 actor、时间、原因、来源对象和前后状态。TaskCenter 不允许通过覆盖历史隐藏状态转换。

## 8. UI边界
首页“今日需要我处理”读 HumanTaskView；完整任务中心可以展示全部 Task；产品状态卡“当前任务”只查询指定 product_id 的未结束任务。

## 9. 运行依赖
真实 Task Repository、事务状态机、优先级排序服务、Policy/Permission 服务、审批动作API、Scheduler/Executor 连接均属于后续实现。