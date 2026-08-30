# 单产品纵向 MVP 对象链与 ID 追溯

## 1. 示例主链
```text
product_id
→ metric_snapshot_id
→ event_id
→ decision_item_id
→ decision_id
→ task_id
→ human_action_request_id
→ approval_id
→ action_id
→ execution_result_id
→ validation_id
→ memory_id
→ stage_summary_id
```

## 2. 追溯要求
任何真实 Action 至少必须能反查：
- 属于哪个 product_id；
- 哪个 Event 触发；
- 哪个 FinalDecision 决定；
- 哪个 Task 承载；
- 是否经过 Approval；
- ExecutionResult 是什么；
- 后续 Validation 结果；
- 是否形成 Memory。

## 3. 允许缺省
并非每个链路都必须经过人工 Approval；但本 MVP 固定选择“需要人工批准的广告调整”场景，因此 approval_id 与 human_action_request_id 为必经节点。

## 4. ID稳定性
- product_id 不因 ASIN/SKU/标题变化而变化；
- event_id 不因 UI重新聚合而变化；
- task/action/result/validation 各自独立；
- View ID/缓存键不得替代业务对象主键。

## 5. 状态独立
- Approval approved 只表示允许进入执行；
- ExecutionResult success 只表示动作执行成功；
- Validation passed 才允许 Task completed；
- Goal achieved / Event resolved 仍需各自规则判断。

## 6. 示例边界
静态示例中的所有 ID 使用 `demo-*`，只验证引用关系，不代表真实用户产品或真实 Amazon 操作。