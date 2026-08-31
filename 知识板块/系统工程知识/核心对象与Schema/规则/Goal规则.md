# Goal 规则 V1

## 1. 定位
`Goal` 是全系统可引用的产品经营目标对象，负责保存“要实现什么、依据什么、如何衡量、什么时候复核”。

它不替代 Agent-1 的目标系统。

- Agent-1目标系统：负责目标选择、主次排序、冲突处理、切换规则。
- Goal Contract：负责把选定后的目标变成可被 Task、Action、Validation、UI、Memory 共同引用的稳定对象。

## 2. 产品关联
所有产品级 Goal 必须关联 `product_id`。

目标可以引用：
- 当前 ProductStage；
- 当前 BusinessState；
- 触发目标的 Event；
- 形成目标的 FinalDecision。

## 3. 主目标与副目标
`priority_class` 仅表达当前目标角色：
- primary：当前主目标；
- secondary：当前副目标；
- supporting：支持性目标；
- watch：观察目标。

真正的冲突排序规则仍由 Agent-1 目标系统维护，不能只靠字段枚举代替。

## 4. 成功标准
Goal 不能只写自然语言愿望。

每个 Goal 至少包含一个 `success_criteria`，明确：
- metric_code；
- operator；
- target_value；
- baseline_ref（如需要）；
- evaluation_window（如需要）。

如果目标无法用单一指标判断，可以使用多个 criterion；最终是否 achieved 可以由后续验证逻辑综合判定。

## 5. 生命周期
建议状态：
`proposed → active → achieved/failed/cancelled/expired/superseded`

也允许 `active ↔ paused`。

目标切换时禁止覆盖旧目标，应：
1. 新建 Goal；
2. 旧 Goal 标记 superseded 或 paused；
3. 记录 `superseded_by_goal_id`；
4. 保留原目标与当时的阶段/状态/决策证据。

## 6. 观察窗口
每个 Goal 必须有 `observation_window.start_at`，并可设置：
- target_end_at；
- review_at。

避免任务刚执行就立刻判定目标失败，也避免目标永久不关闭。

## 7. Task关系
Goal 与 Task 是一对多关系。

- Goal 回答“为什么做”；
- Task 回答“具体要做什么”；
- Action 回答“已经执行了什么”；
- Validation 回答“动作/目标效果怎么样”。

Task 必须能够回指 goal_id，但 Goal 不要求预先包含所有未来 Task。

## 8. UI关系
首页产品摘要显示当前 primary Goal 的简要标题；产品状态卡可进一步显示成功标准、观察窗口、来源阶段/事件/决策与最新验证状态。

UI 不自行创建或切换 Goal；人工调整目标时也必须形成结构化 Goal/状态变更记录。
