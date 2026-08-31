# Agent-2｜商品状态模型

## 1. 目标
把零散页面/后台字段统一为可比较的商品状态快照。状态模型描述“当前是什么”，变化规则描述“从什么变成什么是否值得上报”。

## 2. 状态维度
每个scope可维护以下维度，未知必须写`unknown`而不是猜测：

### availability_state
- active
- inactive
- suppressed
- unavailable
- out_of_stock_display
- restricted
- under_review
- unknown

### page_state
- accessible
- dog_page_or_not_found
- partial_render
- content_missing
- marketplace_mismatch
- unknown

### offer_state
- featured_offer_owned
- featured_offer_lost
- featured_offer_unknown
- no_offer_visible
- unknown

### price_display_state
- normal
- reference_price_visible
- reference_price_missing
- coupon_visible
- coupon_missing
- deal_visible
- deal_missing
- inconsistent
- unknown

### content_state
- complete
- partial_missing
- pending_publish
- front_back_mismatch
- suppressed_content
- unknown

### variation_state
- healthy
- child_detached
- variation_missing
- relation_changed
- parent_unavailable
- unknown

### rating_state
- normal
- changed
- missing
- shared_review_changed
- unknown

### qualification_state
- clear
- pending_review
- action_required
- restricted
- failed
- unknown

## 3. 快照对象
框架建议字段：
```text
snapshot_id
scope_type
scope_id
observed_at
source_refs[]
domains {
  availability_state
  page_state
  offer_state
  price_display_state
  content_state
  variation_state
  rating_state
  qualification_state
}
raw_facts[]
evidence_refs[]
freshness
confidence
previous_snapshot_id
```

此快照是Agent-2专业内部对象，不替代Agent-1的ContextPackage。

## 4. 状态层与经营结论分离
以下是状态：
- Featured Offer丢失；
- 划线价消失；
- 页面不可访问；
- 子体脱离；
- A+未显示。

以下不是Agent-2应直接给出的最终结论：
- “应立刻降价”；
- “应暂停广告”；
- “应拆变体”；
- “应申诉”；
- “应该补货”。

后者只能作为可选专业建议或转交其他Agent，由Agent-1最终决策。

## 5. 多来源冲突
当前台与后台状态冲突时，不选一个“看起来合理”的值覆盖另一个，而应记录：
- source A；
- source B；
- observed_at；
- conflict_type；
- 哪个字段不可确认；
- 需要什么补证据。

冲突本身可成为事件。