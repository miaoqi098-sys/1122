# Agent-3｜变化检测与竞争信号

## 1. 处理链
`当前快照 → 可比性检查 → 选择有效基线 → diff → 持续性/幅度/范围判断 → 信号候选 → 事件或历史更新`

## 2. 变化类型
- price_change：价格展示变化；
- promotion_change：Coupon/Deal等促销变化；
- visibility_change：关键词/类目可见性变化；
- listing_change：标题、图片、卖点、A+、变体、套装等变化；
- rating_display_change：星级/评论数等展示变化；
- new_entry：新品/新父体进入观察范围；
- relation_change：与我方竞争关系升级、降级或失效；
- coordinated_move：同品牌/多实体在相近时间出现同类动作；
- recovery：此前异常或变化状态恢复。

## 3. 单次变化与持续信号
单次变化只说明“观察到变化”，不自动等于稳定竞争信号。除高确定性、高影响事实外，至少考虑：
- 是否在后续观察仍成立；
- 是否多个来源一致；
- 是否仅由页面实验、缓存、搜索波动造成；
- 是否在多个关键词/实体上同时出现；
- 是否与竞品关系有关。

## 4. 信号强度建议
Agent-3可以建议事件severity P0-P3，但不得替代Agent-1 S04的business_priority。

建议时综合：影响范围、变化幅度、持续时间、竞争关系强度、证据质量、可逆性、是否涉及多个竞争实体。

## 5. 去重
相同未恢复变化使用稳定指纹更新，不重复制造Event。建议指纹：
`competitor_entity_id + our_scope + signal_type + normalized_context`

重复观察应更新：last_seen_at、duration、evidence_refs、confidence、current_snapshot_id，而不是重新创建同义事件。

## 6. 恢复
恢复必须关联原signal/event，保留原历史，不删除旧记录。

## 7. 不允许的推断
- 看到竞品降价 ≠ 我方必须降价；
- 搜索位置下降 ≠ 竞品销量下降；
- 评论增长 ≠ 官方销量增长；
- Listing变化 ≠ 该变化一定提升转化。

这些需要Agent-1或对应专业Agent结合其他证据判断。

## 8. 异常路径
工具失败、页面不可读取、来源冲突、快照不可比、竞品映射不确定时，不生成确定性业务事件；优先产生数据质量/证据不足状态并等待复核。