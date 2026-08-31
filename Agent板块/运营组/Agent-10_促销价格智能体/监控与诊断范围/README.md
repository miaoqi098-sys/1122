# 监控与诊断范围

## 核心异常类型
1. `REFERENCE_PRICE_LOST`：参考价/划线展示消失或显著变化；
2. `PRICE_DISPLAY_MISMATCH`：前台价格与预期配置不一致；
3. `PROMOTION_NOT_VISIBLE`：已配置促销未正常展示；
4. `PROMOTION_STACKING_RISK`：多个优惠可能意外叠加；
5. `DEAL_ELIGIBILITY_RISK`：活动资格不确定或失效；
6. `PRICE_HISTORY_CONSTRAINT`：历史价格可能限制未来活动/参考价展示；
7. `MARGIN_CONSTRAINT`：方案触及Agent-6利润边界；
8. `INVENTORY_CONSTRAINT`：促销需求可能超过Agent-7供给能力；
9. `COMPETITIVE_PRICE_GAP`：与市场价格带/竞品价格显著偏离；
10. `PROMOTION_UNDERPERFORMANCE`：活动表现低于可比基线；
11. `PROMOTION_OVERDISCOUNT`：折扣深度超过必要区间；
12. `DATA_QUALITY_RISK`：规则、展示、订单价或历史数据不足。

## 诊断顺序
- 核对前台与后台价格事实；
- 核对当前促销对象和生命周期；
- 核对参考价/历史价格窗口；
- 核对是否存在叠加；
- 核对活动资格与规则版本；
- 请求Agent-6利润边界；
- 请求Agent-7库存承接；
- 请求Agent-3/8市场价格与趋势；
- 评估是否需要Agent-1跨域决策。

## 输出要求
每个诊断必须记录：scope、marketplace、当前价格对象、促销对象、历史窗口、平台规则版本、风险类型、影响、置信度、缺失信息和建议的验证/决策窗口。

## 禁止事项
- 不把历史某个固定天数规则当永久平台规则；
- 不因前台划线消失就自动建议抬高常规售价；
- 不忽略实际订单成交价与优惠叠加；
- 不在未知活动资格下声称“必然可报名”。
