# MetricSnapshot 静态验收 V1

## L1目标
验证 MetricSnapshot 已能作为首页经营概览和后续 Agent 分析的系统级事实快照 Contract。

## 验收项
- [x] 使用 `snapshot_id` 作为快照身份；
- [x] 必须关联 `product_id`；
- [x] 明确 `business_date` 与 `window_start/window_end`；
- [x] 支持 marketplace 时区，避免“今日”口径冲突；
- [x] 单项指标保留 `source_ref` 与 `effective_at`；
- [x] 区分 freshness 与 quality；
- [x] 支持 sales/ad_spend 等基础指标，不把 Agent 结论写入事实对象；
- [x] 利润带 `profit_type/calculation_status/cost_model_version`；
- [x] 成本不完整时可显式记录 `missing_cost_components`；
- [x] 示例字段与 Schema 一致；
- [x] Agent-5/6/1 的使用边界明确；
- [x] 未实现真实 API、数据库或运行时。

## 负向检查
- 仅有 ASIN 而无 `product_id`：不应成为系统级 MetricSnapshot。
- 无 `source_ref` 的指标：不能作为可审计事实条目。
- 广告数据明显滞后但标记 `fresh`：违反新鲜度规则。
- 缺少采购/退款等关键成本却标记利润 `complete`：违反利润完整度规则。
- 将“建议提高预算”等内容写入 metrics：越界，应进入分析/决策对象。

## 运行依赖
未来仍需：真实采集、时区窗口计算、指标字典/公式注册、数据质量判定、利润计算服务、持久化与版本修订机制。这些不阻塞当前静态 Contract 成立。

## L1结论
`✅ 通过`。
