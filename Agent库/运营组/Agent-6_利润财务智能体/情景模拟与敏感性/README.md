# 情景模拟与敏感性

## 定位
本模块把利润判断从“描述当前”扩展为“在明确假设下评估可能结果”。所有模拟均为决策支持，不等于预测承诺，更不能直接替代 Agent-1 的最终决策。

## 标准输入变量
- `price` 售价；
- `units` 销量；
- `cvr` 转化率；
- `cpc` 点击成本；
- `acos` 广告成本销售比；
- `ad_spend` 广告花费；
- `cogs` 单位采购成本；
- `fba_fee` 履约费；
- `storage_fee` 仓储费；
- `refund_rate` 退款率；
- `promo_discount` 促销让利；
- `other_variable_cost` 其他变动成本。

## 模拟类型
1. 单变量敏感性：只改变一个变量，其他保持不变；
2. 双变量敏感性：例如价格×CVR、CPC×CVR、销量×仓储；
3. 情景包：保守/基准/积极；
4. break-even反推：反推可承受CPC、ACOS、折扣、采购成本或退款率；
5. 风险边界：识别利润由正转负或跌破目标利润率的阈值。

## 必须记录的假设
每次模拟都要保存：
- 基准期与数据版本；
- 变量改变幅度；
- 保持不变的变量；
- 是否假设线性关系；
- 是否考虑CVR、价格、流量之间联动；
- 成本/费用是否存在阶梯或固定项；
- 结果的适用scope和有效期。

## 非线性警告
以下场景默认不能机械线性外推：
- 大幅降价可能改变CVR、流量和广告效率；
- CPC变化可能改变流量结构；
- 销量变化可能改变FBA、仓储、补货和缺货风险；
- 促销可能改变自然流量与品牌词占比；
- 退款/退货存在成熟期延迟。

出现这些情况时，结果必须标记 `assumption_risk=high`，并请求对应专业Agent补充解释。

## 输出结构
- scenario_id；
- scope；
- baseline_ref；
- changed_variables；
- fixed_assumptions；
- projected_revenue；
- projected_contribution_profit；
- projected_margin；
- break_even_distance；
- key_sensitivity_drivers；
- assumption_risk；
- confidence；
- invalidation_conditions。

## 禁止事项
- 不把模拟值伪装成真实发生值；
- 不在缺少成本口径时给“净利润预测”；
- 不把break-even ACOS直接下发为广告目标；
- 不在高假设风险下给确定性动作建议。
