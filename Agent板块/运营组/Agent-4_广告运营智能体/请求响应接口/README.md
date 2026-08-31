# Agent-4｜请求响应接口

## 1. 定位
Agent-4既可主动向Agent-1发送广告智能事件，也可响应Agent-1或其他被授权模块的广告专业分析请求。请求响应只提供广告域事实、诊断和候选建议，不返回FinalDecision。

## 2. 请求类型
- diagnose_entity：诊断campaign/ad_group/target/search_term；
- analyze_search_term：分析搜索词质量与迁移/否定候选；
- evaluate_bid：评估竞价调整候选；
- evaluate_budget：评估预算限制、闲置或重分配候选；
- evaluate_structure：评估拆分/合并/隔离；
- compare_windows：比较当前与基线窗口；
- validate_advertising_effect：验证某次广告策略变更后的广告侧结果；
- explain_signal：解释已产生的Agent-4事件。

## 3. 请求最小字段
request_id、requester_agent、request_type、scope、target_entities、question、data_window、constraints_refs、context_refs、requested_at。

如缺少可完成分析的关键数据，返回needs_information，不自行补造事实。

## 4. 响应结构
见 `AdvertisingAnalysisResponse.schema.json`。响应至少包含：request_id、responder_agent、status、scope、facts、diagnoses、recommendation_candidates、evidence_refs、data_quality、cross_agent_dependencies、generated_at。

status：completed / partial / needs_information / unsupported / blocked。

## 5. facts与diagnoses分离
facts只能记录可追溯数据事实；diagnoses是基于事实的专业解释，必须带confidence和evidence_refs。不得把推断写进facts。

## 6. needs_information
若缺少广告报表、归因口径、搜索词明细、历史变更、基线窗口等关键输入，应明确列出missing_inputs和why_needed。若可在不完整数据下做部分分析，status=partial并标记limitations。

## 7. 跨Agent依赖
如果问题实际需要利润、库存、Listing、价格促销或总流量上下文，Agent-4不得越权代答，应返回cross_agent_dependencies，由Agent-1协调Agent-5/6/7/9/10/13等补齐。

## 8. 响应边界
- 不输出FinalDecision；
- 不直接创建Task；
- 不声称API动作已执行；
- 不以广告归因销售替代总销售/利润；
- 不隐藏数据缺失与归因限制。