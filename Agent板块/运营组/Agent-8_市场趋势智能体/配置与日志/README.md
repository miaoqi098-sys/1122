# 配置与日志

## 配置项
- 候选趋势最小持续窗口；
- 多源确认最小信号数量；
- trend strength阈值；
- breadth与persistence阈值；
- 季节性基线窗口；
- event-driven冷却窗口；
- 数据新鲜度要求；
- 外部来源可靠性等级；
- 各marketplace/region日历版本。

## 配置版本
任何会改变趋势确认规则的配置都必须记录 `config_version`、`effective_from`、`changed_fields`、`reason`。阈值变化后，不追溯性修改旧事件结论；若需要重算，必须生成新版本结果。

## 日志
至少记录：
- trend_id / event_id / response_id；
- subject和scope；
- 使用的signals；
- baseline_ref；
- seasonality/event context；
- conflicting_signals；
- trend_status变化；
- confidence变化；
- 配置版本；
- 生成/升级/结束时间。

## 防循环
同一趋势在无新证据情况下不得反复在candidate/confirmed之间切换。状态反转必须记录新证据和原因。
