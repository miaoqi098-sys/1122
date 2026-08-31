# Agent-5｜指标与口径

## 1. 原则
任何流量指标必须绑定：来源、scope、marketplace、product/query对象、时间窗口、数据来源、统计口径和新鲜度。没有可比口径时不得直接计算趋势。

## 2. 常见指标
- impressions / search_impressions；
- clicks；
- sessions / page_views（按来源可用性）；
- traffic_share / source_share；
- query_share / keyword_concentration；
- organic_rank / search_position（若来源可得）；
- click_share / impression_share；
- paid_vs_organic_mix；
- source_growth_rate；
- visibility_index（仅在定义清楚算法与样本集时使用）。

## 3. 口径约束
- 广告clicks不等于总sessions；
- Search Query Performance的impressions/clicks与广告报表口径不能直接相加；
- organic rank来自不同工具时需记录source和采样方式；
- 流量share必须写明分母；
- “关键词排名提升”必须说明Query、marketplace、采样时间与来源；
- 外部流量无法可靠归因时保持unknown/estimated，不伪造成精确值。

## 4. 窗口
变化判断至少包含current_window和baseline_window。重大活动、断货、价格变化、Listing变更、广告大调整应标记confounder。

## 5. 数据质量
每个指标包至少带：source_ref、generated_at、data_window、timezone、freshness、completeness、sampling_method（如适用）、missing_data、definition_version。

## 6. 分母为0
占比/增长率等分母为0时返回undefined/null并说明原因，不伪造0或无穷大。

## 7. 边界
广告效率指标由Agent-4负责；转化率与Listing承接由Agent-9负责；市场需求趋势由Agent-8负责。Agent-5可以引用这些指标作为上下文，但不替代其专业判断。