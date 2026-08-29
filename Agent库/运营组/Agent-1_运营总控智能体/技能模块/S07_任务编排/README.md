# S07｜任务编排

## 技能定位
把Agent-1已经选定的经营方案转换成可执行、可审批、可监控、可回滚、可验证的任务网络（Task Plan / Task DAG）。

S07负责“把决策组织成任务”，不负责真正调用API执行，也不负责定时器运行；调度由共享调度与自动化层负责，真实执行由执行层负责，经营结果验证由S08负责。

## 调用位置
```text
Agent-1选定S05方案
+
S06风险评估与required_controls
↓
S07读取selected_option / risk_assessment / active_tasks / capabilities / permissions
↓
拆分原子任务
↓
把风险控制转成控制任务或前置条件
↓
分配owner / executor / approver / validator
↓
建立Task DAG
↓
检查依赖 / 并行 / 互斥 / 审批 / 资源
↓
输出任务网络
↓
调度层 + 执行层
↓
S08验证
```

## 任务类型 task_type
- `execution`：真正改变经营状态的执行任务；
- `monitoring`：监控指标、状态或停止线；
- `approval`：需要人工/授权层确认；
- `data_collection`：获取执行或判断所需数据；
- `validation`：进入S08前后的验证节点；
- `control`：落实S06 required_controls、保护线或执行前防护；
- `rollback`：触发后执行恢复动作。

## 角色拆分
每个任务根据需要区分：
- `owner`：对任务结果负责的业务责任方；
- `executor`：真正执行动作的Agent、工具、API执行器或人工角色；
- `approver`：审批人/审批角色；
- `validator`：负责验证执行结果与经营结果的验证方。

不得用一个owner字段同时混淆“谁负责、谁点按钮、谁批准、谁验收”。

## 结构化 action
任务中的action不再只是自然语言字符串，应尽量包含：
- `action_type`
- `target`
- `operation`
- `parameters`
- `scope`
- `tool_or_executor`
- `expected_state_change`

“优化广告”“改善Listing”“控制库存”不是合格执行动作，必须拆到可以交给执行器或人工明确执行的粒度。

## Task DAG关系
每个任务可描述：
- `depends_on`：必须先完成哪些任务；
- `blocks`：本任务未完成会阻塞哪些任务；
- `parallel_with`：哪些任务可以并行；
- `mutex_with`：哪些任务不可同时运行。

S07必须检查循环依赖和互斥冲突。

## 风险控制落地
S06输出的 `required_controls` 不能停留在风险说明里。

S07必须把它们转成以下一种或多种：
- control任务；
- start_condition；
- stop_condition；
- monitoring任务；
- approval任务；
- rollback任务。

只有落实这些控制后，`eligible_with_controls` 的方案才应进入可执行状态。

## 生命周期
```text
created
↓
pending_approval
↓
ready
↓
running
├─ blocked
├─ failed
├─ cancelled
└─ awaiting_validation
       ↓
   completed
   rolled_back
```

其中：
- `blocked`：任务本身未失败，但被依赖、资源、审批、数据或其他条件阻塞；
- `failed`：任务已经尝试执行但执行失败。

两者不得混淆。

## 每个任务至少定义
- `task_id`
- `decision_id`
- `product_id`
- `task_type`
- `owner`
- `executor`
- `action`
- `business_priority`
- `depends_on`
- `approval_level`
- `start_condition`
- `deadline_or_window`
- `success_criteria`
- `stop_conditions`
- `rollback`
- `validator`
- `status`

## 与S04的边界
S04决定哪个经营问题更重要；S07根据已经选定的方案安排具体任务依赖和执行网络。执行顺序不应反向篡改S04的business_priority。

## 与调度/执行层的边界
S07只产出任务计划和约束，不直接：
- 运行定时器；
- 调用Amazon API修改数据；
- 执行失败重试；
- 保持长期任务状态机；
- 代替共享执行层实施变更。

这些属于共享基础设施。

## 核心原则
一个好决策必须能被翻译成“谁负责、谁执行、先做什么、什么能并行、什么不能同时做、需要什么审批、什么时候停、怎么回滚、谁来验证”的清晰任务网络。

## 当前版本
V1.1：加入S05/S06完整承接、结构化action、正式Task DAG、四角色拆分、task_type、blocked/failed生命周期，以及S07与调度层/执行层的边界。