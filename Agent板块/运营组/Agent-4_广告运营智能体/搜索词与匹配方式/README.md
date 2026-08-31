# Agent-4｜搜索词与匹配方式

## 1. 核心区分
Target是广告投放对象，Search Term是用户实际搜索表达。两者必须独立记录、关联分析，禁止直接等同。

## 2. 匹配方式范围
关键词投放至少区分：broad / phrase / exact；自动投放需保留close match、loose match、substitutes、complements等可用分类；商品投放记录ASIN/category targeting；否定需区分negative exact与negative phrase。

## 3. 搜索词分析框架
每个search_term至少关联：source_target_id、campaign_id、ad_group_id、match_context、impressions、clicks、spend、orders、sales、CTR、CPC、CVR、ACOS/ROAS、current_window、baseline_window、source_ref。

## 4. 迁移原则
高质量search term满足稳定相关性、足够样本、转化证据和经济可承受性时，可形成“从发现型流量迁移到更可控Target”的建议。迁移不等于必须暂停原来源，需评估：
- 原来源是否仍承担探索；
- 新旧投放是否会形成可接受的重叠；
- 是否需要独立预算/竞价；
- 观察窗口是否足够；
- 是否应先建立Exact再逐步收缩Broad/Auto。

## 5. 否定原则
否定只能在证据充分时建议：
- 明显不相关意图；
- 足够点击/花费且持续无转化；
- 已迁移到更可控结构且原入口继续造成明显内耗；
- 与产品定位、合规或库存状态冲突。

禁止仅因短期0单就自动否定。否定前必须检查样本量、价格/Listing变化、促销、库存和归因延迟。

## 6. Broad / Phrase / Exact职责
- Broad：探索和扩展相关意图，允许较宽流量但需更强搜索词治理；
- Phrase：控制词序/语义范围，承担中间探索与收敛；
- Exact：承接已验证高价值意图，便于独立竞价、预算、排名与观察。

匹配方式不是天然优劣排序，同一词在不同匹配方式必须视为不同流量入口分别评估。

## 7. 重叠与内耗
同一搜索意图在多个campaign/ad_group/target中出现时，标记overlap，不直接认定“自相残杀”。需结合竞价、placement、预算、流量分配、转化差异判断是否需要隔离。

## 8. 输出建议类型
- harvest_to_exact
- harvest_to_phrase
- keep_exploration
- reduce_bid
- isolate_target
- add_negative_exact
- add_negative_phrase
- pause_candidate
- observe

每个建议必须带evidence_refs、confidence、expected_effect、risk、observation_window和rollback_condition。

## 9. 边界
关键词自然排名、SEO与总搜索流量由Agent-5/Agent-9等模块协同；Agent-4只对广告搜索词和投放匹配关系负责。