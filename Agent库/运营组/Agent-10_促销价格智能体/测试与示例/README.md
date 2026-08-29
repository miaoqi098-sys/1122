# 测试与示例

## 静态验收目标
验证 Agent-10 能正确区分价格对象、促销对象、参考价历史、活动资格和跨Agent约束，并避免把平台历史规则写死。

## 必测场景
1. 后台List Price存在但前台无划线：应输出REFERENCE_PRICE_LOST/展示事实差异，不宣称后台字段等于前台展示；
2. Coupon与Promotion Code可能叠加：输出PROMOTION_STACKING_RISK；
3. Deal价格低于Agent-6利润边界：输出MARGIN_CONSTRAINT；
4. 大促窗口库存覆盖不足：输出INVENTORY_CONSTRAINT并请求Agent-7；
5. 活动资格规则版本未知：eligibility不得写“通过”；
6. 前台促销未展示：输出PROMOTION_NOT_VISIBLE；
7. 订单实际成交价低于理论优惠价：检查叠加/特殊资格；
8. 高频价格变动导致历史基线不稳定：输出PRICE_HISTORY_CONSTRAINT；
9. 市场价格带下降但自身利润不允许跟价：上报Agent-1跨目标权衡；
10. 促销后销量涨但广告/季节也变化：不把全部uplift归因促销。

## 示例A｜划线价消失
后台参考价字段未改，但前台Was Price消失。正确：记录前台展示事实变化、价格历史与规则版本，不能简单输出“重新填List Price即可恢复”。

## 示例B｜活动叠加风险
Coupon 20%与促销代码20%在目标买家条件下可能共同生效。正确：理论最深折扣进入stacking风险，并请求订单成交验证与Agent-6利润评估。

## 示例C｜活动资格未知
历史经验显示某Deal常看一定价格窗口，但当前平台规则未验证。正确：`needs_rule_verification`，不使用历史经验当永久规则。

## 验收判定
- 价格对象与成交价分离；
- 促销对象和生命周期明确；
- 平台规则版本化；
- 利润/库存/广告/内容冲突检查存在；
- 事件/响应可供Agent-1消费；
- 真实价格促销执行留在R08/人工流程。
