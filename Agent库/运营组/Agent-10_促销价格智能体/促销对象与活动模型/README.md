# 促销对象与活动模型

## 目标
统一不同促销机制的对象、资格、时间、价格影响与叠加关系，避免把所有优惠都当成同一种折扣。

## 促销对象
- `coupon`；
- `deal`（如BD/LD等平台Deal类型，具体名称由marketplace规则映射）；
- `prime_exclusive_discount` / 会员优惠；
- `promotion_code`；
- `sale_price_window`；
- `bundle_or_quantity_discount`；
- `external_promotion`：站外促销，仅作为可能影响成交价/流量的外部事实记录。

## 标准字段
- promotion_id；
- promotion_type；
- marketplace；
- scope/asin/sku；
- start_at / end_at；
- configured_discount；
- eligibility_status；
- eligibility_reason；
- expected_effective_price；
- stackability；
- audience_condition；
- platform_rule_ref；
- cost_owner；
- status；
- source；
- last_verified_at。

## 生命周期
`planned → submitted → eligible/ineligible → scheduled → active → ended/cancelled`

规则变化、价格历史变化或资格检查失败时，可进入 `needs_review`。

## 叠加关系
促销必须显式标记：
- 是否可能与当前售价叠加；
- 是否可能与Coupon/Promotion Code/会员优惠叠加；
- 是否存在买家资格差异；
- 理论最深折扣与实际成交验证方式；
- 是否触发财务/参考价风险。

## 原则
平台活动规则属于版本化外部规则，不能永久写死；Agent-10只在有明确规则证据时判定eligibility，否则状态为 `unknown/needs_review`。

## 边界
促销对象描述活动事实与计划，不代表活动值得做。利润边界由Agent-6、库存承接由Agent-7、最终是否报名/执行由Agent-1决定。
