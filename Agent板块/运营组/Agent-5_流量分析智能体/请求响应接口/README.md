# Agent-5｜请求响应接口

## 1. 请求类型
支持Agent-1发起：analyze_traffic_change、analyze_source_mix、analyze_query_visibility、compare_windows、build_cause_tree、evaluate_traffic_opportunity、explain_signal。

## 2. 请求最小字段
request_id、requester_agent、request_type、scope、question、current_window、baseline_window、context_refs、constraints_refs、requested_at。

## 3. 响应
见 `TrafficAnalysisResponse.schema.json`。响应应分离facts与diagnoses，并提供cause_candidates、evidence_refs、data_quality、cross_agent_dependencies、limitations与generated_at。

## 4. 状态
completed / partial / needs_information / unsupported / blocked。

## 5. 信息不足
若缺少来源拆分、Query证据、基线窗口、商品状态或其他关键上下文，返回needs_information；若能做部分判断则partial并列出limitations。

## 6. 边界
Agent-5不得替Agent-4回答广告竞价/预算细节，不替Agent-8确认市场趋势，不替Agent-9确认Listing内容根因，不替Agent-1形成FinalDecision。