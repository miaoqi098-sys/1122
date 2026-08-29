# 配置与日志

## 配置项
- 各marketplace价格/促销规则版本；
- 活动资格检查规则；
- 参考价/价格历史窗口定义；
- 折扣深度分级；
- 促销叠加检查规则；
- 价格变化频率保护；
- 数据新鲜度要求；
- 高影响价格变更升级阈值；
- 活动前后观察窗口。

## 版本规则
平台规则、资格条件、历史窗口和促销类型发生变化时必须创建新 `rule_version/config_version`，保留旧版本生效时间，不覆盖历史结论依据。

## 日志
至少记录：
- analysis_id / event_id / response_id；
- scope/marketplace；
- current_price_refs；
- promotion_refs；
- price_history_window；
- rule_version_ref；
- constraint_refs；
- eligibility_status；
- stacking_check；
- confidence；
- 生成与复核时间。

## 保护
价格规则未知、资格来源过期或前台展示无法验证时，日志必须记录降级，不允许静默给确定性结论。
