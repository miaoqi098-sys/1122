# Agent-5｜事件类型与输出

## 1. 事件类别
异常：total_traffic_drop、source_shift、organic_visibility_drop、query_visibility_loss、traffic_concentration_risk、external_traffic_drop、data_quality_anomaly。机会：rising_query_opportunity、organic_recovery_opportunity、source_diversification_opportunity、visibility_gap、traffic_growth_candidate。升级：market_demand_check、advertising_check、listing_check、product_status_check、price_promotion_check、competitor_check。

## 2. 触发要求
事件必须带scope、affected_sources/queries、current_window、baseline_window、severity、confidence、evidence_refs、data_quality和cause_candidates。证据不足只能输出observed/suspected，不得伪装成confirmed。

## 3. 输出边界
事件用于Agent-1统一决策，不是FinalDecision；涉及广告、市场趋势、Listing、价格、库存等专业根因时必须保留cross_agent_requests。

## 4. 去重
相同scope + event_type + affected_sources/queries + active context的事件优先更新原事件状态，不重复创建等价事件。

## 5. 标准对象
见 `TrafficIntelligenceEvent.schema.json`。