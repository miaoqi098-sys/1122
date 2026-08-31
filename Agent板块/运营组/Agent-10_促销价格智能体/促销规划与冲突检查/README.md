# 促销规划与冲突检查

## 目标
在提出促销方案前，统一检查利润、库存、广告、内容、价格历史与活动资格冲突，避免单域优化。

## 规划输入
- 当前价格与参考价状态；
- 促销类型与候选折扣；
- 目标时间窗；
- Agent-6利润边界；
- Agent-7库存覆盖和补货窗口；
- Agent-4广告承接计划；
- Agent-9内容/转化状态；
- Agent-3/8竞争价格与市场趋势；
- 平台规则版本与资格状态。

## 冲突类型
1. `MARGIN_CONFLICT`：折扣触及利润底线；
2. `INVENTORY_CONFLICT`：库存无法承接预期需求；
3. `ADVERTISING_CONFLICT`：广告扩量/缩量与促销节奏冲突；
4. `CONTENT_READINESS_CONFLICT`：内容/页面问题未解决；
5. `REFERENCE_PRICE_CONFLICT`：价格历史/参考价策略可能被破坏；
6. `STACKING_CONFLICT`：多促销叠加导致超深折扣；
7. `ELIGIBILITY_CONFLICT`：活动资格不满足或规则不确定；
8. `TIMING_CONFLICT`：多个活动过近，难以建立稳定基线；
9. `SUPPLY_CHAIN_CONFLICT`：在途/补货无法覆盖活动窗口。

## 方案结构
每个候选促销方案至少包含：
- promotion_type；
- planned_window；
- discount_range；
- expected_effective_price；
- profit_constraint_ref；
- inventory_constraint_ref；
- rule_version_ref；
- conflicts；
- required_controls；
- measurement_plan；
- rollback/stop_conditions；
- confidence。

## 终止/降级
若利润边界未知、库存数据不可信、活动资格未验证或叠加规则不清，应降级为 `needs_information`，而不是强行推荐。

## 边界
Agent-10生成价格/促销专业方案，不拥有最终是否执行的决策权；由Agent-1进行跨目标选择。
