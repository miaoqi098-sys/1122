# Agent-5｜关键词与搜索可见性

## 1. 定位
Agent-5负责Query/关键词层面的“是否被看到、从哪里被看到、可见性如何变化、哪些关键词贡献流量”，而不是广告投放匹配治理或Listing文案优化。

## 2. 观察对象
- query / keyword；
- product/ASIN；
- marketplace；
- organic visibility；
- paid visibility；
- total search visibility；
- impression/click share；
- rank/position（有可靠来源时）。

## 3. 分层
建议区分：
- brand terms；
- category/core generic terms；
- feature/attribute terms；
- use-case/scenario terms；
- competitor/alternative terms；
- long-tail terms。

分类只用于分析，不自动决定广告或Listing动作。

## 4. 可见性变化诊断
关键词可见性下降可能来自：
- 搜索需求下降；
- 自然排名下降；
- 广告覆盖下降；
- 竞品份额提升；
- 商品不可售/购物车/价格异常；
- Listing相关性变化；
- 数据采样/来源变化。

不得把“排名下降”作为唯一默认根因。

## 5. Organic / Paid分离
同一Query下应尽可能分别记录organic与paid证据。paid search term治理交Agent-4；Agent-5只在整体Query可见性层引用paid贡献。

## 6. 关键词集中度
需识别流量是否过度集中在少数Query。可使用top-N share、HHI或其他明确算法，但算法必须版本化，不把单一阈值固化成普适规则。

## 7. 机会识别
可生成：
- visibility_gap；
- rising_query_opportunity；
- lost_visibility_recovery；
- organic_paid_mix_imbalance；
- query_concentration_risk。

机会输出必须带evidence_refs、confidence和需要协同的Agent，不直接形成执行动作。

## 8. 边界
广告关键词投放由Agent-4；Listing关键词布局和内容承接由Agent-9；市场趋势与新兴Query需求由Agent-8；最终优先级由Agent-1。