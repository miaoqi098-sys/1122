# 价格对象与状态模型

## 目标
统一商品价格相关事实，明确“当前售价”“参考价”“划线价展示”“实际成交价”“促销后价格”不是同一个对象。

## 核心价格对象
- `list_price`：声明/目录参考价（适用时）；
- `was_price`：前台历史参考/划线展示事实（适用时）；
- `current_offer_price`：当前前台报价；
- `buy_box_price`：购物车报价；
- `sale_price`：后台或促销相关售价；
- `coupon_effective_price`：Coupon应用后的理论价格；
- `deal_price`：Deal活动价格；
- `promotion_effective_price`：促销代码等条件下的理论价格；
- `realized_order_price`：订单层实际成交价；
- `net_realized_price`：扣除卖家承担促销让利后的有效收入价格口径，由Agent-6进一步财务核算。

## 标准价格状态
每个价格事实至少记录：
- price_type；
- amount；
- currency；
- scope；
- source；
- observed_at；
- valid_from / valid_to；
- display_status；
- condition；
- rule_version_ref；
- confidence。

## 关键原则
1. 前台划线展示是一项观察事实，不等同卖家后台填写的List Price；
2. 当前报价与订单实际成交价必须区分；
3. Coupon/Promotion Code的理论优惠价与最终订单价必须区分；
4. 不同买家资格、Prime身份、地区、时间可能导致展示和成交不同；
5. 不同marketplace价格规则不得共用未标注规则；
6. 所有价格对象必须保留时间维度，禁止覆盖历史。

## 价格一致性检查
- 前台当前价与后台有效价是否一致；
- 划线/参考价展示是否存在；
- Coupon/Deal展示是否与配置一致；
- 订单成交价是否出现超出预期的叠加折扣；
- 价格变化后是否影响活动资格或参考价展示。

## 边界
Agent-10负责价格事实、规则和方案；利润影响由Agent-6计算，最终执行由Agent-1决策。
