# Agent-5｜流量来源模型

## 1. 目的
统一描述产品流量来自哪里，避免把Sessions、广告点击、Search Query曝光等不同层级指标混成一个“流量”。

## 2. 一级来源
建议框架层至少区分：
- organic_search：自然搜索；
- paid_search：站内广告搜索流量；
- browse_recommendation：类目浏览、推荐、关联等站内非搜索入口；
- external：站外社媒、达人、联盟、独立站等可识别来源；
- direct_or_unknown：直接访问或无法可靠归因来源；
- other_internal：其他站内来源。

不同数据源无法精确映射时保留unknown，不强行分配。

## 3. 来源对象字段
建议至少记录：source_type、source_subtype、scope、marketplace、product_id、query/keyword_ref、campaign_ref（如适用）、current_window、sessions/clicks/impressions（按来源可用性）、share、source_ref、freshness、completeness。

## 4. 结构分析
核心问题包括：
- 来源占比是否发生明显迁移；
- 总流量增长是否由单一来源驱动；
- 自然流量是否被广告流量变化掩盖；
- 某来源下降是否被其他来源补偿；
- 流量是否过度集中在少数Query/入口；
- 站外或推荐流量是否形成短期脉冲而非稳定增量。

## 5. 可比性
不同来源的impressions/clicks/sessions定义可能不同，禁止跨口径直接相加。优先比较同一来源同一口径的趋势，再做结构占比分析。

## 6. 与Agent-4边界
Agent-5只把paid_search作为整体流量来源之一；广告内部campaign/ad_group/target/search_term的效率、竞价、预算与结构治理交Agent-4。

## 7. 与Agent-9边界
Agent-5负责“流量到达多少、从哪里来”；Agent-9负责“到达后Listing如何承接与转化”。若流量稳定但转化下降，应升级Agent-9而不是把问题继续归入流量原因。