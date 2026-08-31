# Agent-3｜竞品池与关系模型

## 1. 目标
竞品池不是一张永久ASIN黑名单，而是“我方scope与外部竞争实体之间的可解释关系集合”。任何竞品入池都必须回答：为什么它值得跟踪、与我方在哪里竞争、当前关系是否仍有效。

## 2. relationship_type
- `direct_competitor`：核心用途、价格带、目标人群高度重合；
- `substitute`：可替代需求但产品形态/价格带不同；
- `price_anchor`：用户比较价格/价值时形成明显锚点；
- `traffic_competitor`：在关键搜索词/类目曝光上持续与我方竞争；
- `feature_benchmark`：功能/套装/内容呈现值得跟踪；
- `new_entrant_watch`：新品或快速增长对象，尚未确认稳定竞争关系；
- `brand_watch`：品牌级观察对象；
- `other_watch`：有明确理由的临时观察对象。

一个实体可以拥有多个关系，但必须分别保留依据。

## 3. 竞品实体建议字段
```text
competitor_entity_id
entity_type: asin / parent_product / brand
entity_ref
marketplace
related_our_scopes[]
relationship_types[]
relationship_evidence[]
watch_priority
status: candidate / active / downgraded / removed
first_added_at
last_reviewed_at
valid_until
source_refs[]
notes
```

## 4. 入池条件
至少满足一个可证据化条件：
- 高频出现在同一核心关键词/类目位置；
- 产品功能、用途、目标人群高度可替代；
- 用户/市场数据明确表明存在比较关系；
- 价格/促销动作持续影响我方竞争环境；
- 新品短期快速获取同类曝光/销量代理信号；
- 人工明确指定观察且说明原因。

## 5. 禁止机械入池
以下不能单独作为永久竞品理由：
- 只因为类目相同；
- 只因为价格接近；
- 单次搜索结果偶然出现；
- 未验证的第三方推荐；
- “看起来像竞品”。

## 6. 复核与出池
竞品关系必须定期复核。以下情况可降级/移除：
- 长期不再共享核心关键词/需求；
- 产品定位显著变化；
- ASIN失效/长期不可售；
- 初始入池证据被否定；
- 新数据表明只是偶然曝光。

移除不删除历史，保留旧关系和有效期。

## 7. 我方多产品关系
同一竞品可能只与我方某个ASIN/变体竞争，不能自动扩展到整个品牌/店铺。必须按related_our_scopes保存关系。

## 8. 业务边界
竞品池决定“观察谁”，不决定“对它采取什么策略”。策略仍由Agent-1结合其他专业Agent判断。