# Agent-4｜指标与归因口径

## 1. 原则
任何广告指标必须绑定：实体层级、广告类型、marketplace、时间窗口、归因窗口/口径、货币和数据来源。没有统一口径时不得直接比较。

## 2. 基础指标
- impressions
- clicks
- spend
- attributed_orders
- attributed_sales
- CTR = clicks / impressions
- CPC = spend / clicks
- CVR = attributed_orders / clicks
- ACOS = spend / attributed_sales
- ROAS = attributed_sales / spend

除法分母为0时必须返回undefined/null，不得伪造0。

## 3. 口径约束
- SP/SB/SD归因规则可能不同；
- 同一广告类型不同报表/时间口径可能不同；
- 搜索词、target、ad_group、campaign汇总不可在未说明聚合方式时互相代替；
- 归因销售不是总销售；
- 广告CVR不是Listing整体CVR；
- ACOS/ROAS不是利润指标。

## 4. 诊断时必须带窗口
短期波动与长期趋势分开。任何“上升/下降/变差/改善”至少要说明current_window与baseline_window。

## 5. 数据质量
需记录：source_ref、generated_at、data_window、attribution_definition、currency、completeness、freshness、missing_data。

## 6. 跨Agent边界
利润可承受范围交Agent-6；自然流量/总流量结构交Agent-5；Listing整体转化交Agent-9；Agent-4只负责广告口径内的表现诊断和专业建议。