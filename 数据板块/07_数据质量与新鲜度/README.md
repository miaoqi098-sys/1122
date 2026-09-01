# 07 数据质量与新鲜度

1122 不允许“接口成功 = 数据可信”。所有经营数据都需要 Data Quality（数据质量）和 Freshness（新鲜度）状态。

## 状态

- `REAL`：真实且当前可用；
- `STALE`：数据已超过允许的新鲜度；
- `DEGRADED`：使用降级来源/不完整数据；
- `PENDING_SOURCE`：数据源尚未接入；
- `PENDING_MODEL`：事实已具备，但派生模型尚未完成；
- `PENDING_VALIDATION`：已读到数据，但业务语义仍需验证；
- `UNKNOWN`：无法判断。

## D1

`data_source_state` 保存每个数据集：
- status
- last_success_at
- last_attempt_at
- freshness_status
- schema_version
- parser_version

## 原则

- stale 数据必须在 UI 和 Agent 输入中可见；
- 数据缺失不能自动解释成 0；
- Finance `0 transactions` 当前属于语义待验证，不等于没有财务活动；
- 任何修正解析器的重算必须记录 parser_version。
