# Action + ExecutionResult 规则 V1

## 1. 边界
- Action：真实发生或被尝试执行的经营动作台账事实。
- ExecutionResult：执行器/人工/外部平台对该动作返回的执行结果。

Action ≠ Task；Task 表示要做什么，Action 表示实际做了什么。
ExecutionResult ≠ ValidationResult；执行成功不代表经营效果成功。

## 2. Action Ledger
所有会改变真实经营对象的动作都必须形成 Action 记录，至少可追溯：
`product_id → event_id → decision_id → task_id → action_id → execution_result_id`。

必须记录 actor_type/actor_id、executed_at、business_reason、target、before/requested/applied value（适用时）。

## 3. 审批
需要审批的动作必须带 approval_id；未通过权限/审批检查不得产生“已执行成功”的 Action 事实。

## 4. UI
产品状态卡“今日已执行操作”按 Action.executed_at 查询，而不是按 Task completed 查询。
每条操作必须尽量回答：谁、何时、为什么、改了什么、结果、关联任务/决策。

## 5. 失败与部分成功
ExecutionResult 必须区分 success / partial_success / failed / rejected / not_executed。外部平台部分应用时不得伪装 success。

## 6. 验证
ExecutionResult 产生后进入 Validation；Task 是否 completed、Event 是否 resolved、Goal 是否 achieved 均由各自规则决定，不得被 ExecutionResult.success 自动推进。

## 7. 回滚
回滚是新的 Action，并引用原 task/action；不得修改或删除原 Action 历史。

## 8. 运行依赖
真实 Executor、Action Ledger 持久化、外部操作结果归一化、回滚执行器属于后续运行建设。