# Goal 生命周期实现任务包 V1

> 覆盖：R-GP-011、R-GP-012

## 1. Goal Repository
未来至少支持：
- create Goal；
- get current primary Goal by product_id；
- list history；
- supersede；
- pause/resume/close；
- 查询 Goal 与 Event/Decision/Task 的引用链。

## 2. 生命周期
建议状态：draft / active / paused / achieved / failed / superseded / cancelled。

任何状态变化必须保留：previous_status、changed_at、actor、reason、source_ref。

## 3. Goal Evaluator
输入：Goal.success_criteria、MetricSnapshot、ValidationResult、observation_window。
输出：progress / achieved / not_achieved / insufficient_data。

Agent-1可以选择、排序和切换 Goal，但 Goal 事实本身必须由 Repository 持久化，不能只存在于 Prompt 或模型上下文。

## 4. 主目标切换
- 旧 Goal 不删除；
- 新 Goal 引用 supersedes_goal_id；
- 形成 AgentActivity；
- 写入 Memory；
- 若已有 Task 依赖旧 Goal，需要显式判断继续/取消/重规划。

## 5. 失败路径
- 缺 success criteria → invalid_goal
- observation_window 未结束 → pending
- 数据不足 → insufficient_data
- 多个 primary active Goal 冲突 → requires_resolution

## 6. 验收条件
- 每个产品最多一个 current primary Goal；
- Goal 可回溯到来源 Decision/Event；
- Goal进度有数据证据；
- 切换目标不覆盖历史；
- Agent-1 的目标逻辑与公共 Goal Repository 不重复定义状态事实。

## 7. 静态L1
Goal Repository、评估器、切换和失败路径已明确。未实现服务。L1：PASS。