# Agent-6｜利润指标与口径

## 1. 原则
所有利润指标必须声明收入、成本组件、时间窗口、currency、marketplace、是否含广告/促销/仓储/退款/固定成本，以及使用的cost_profile_version。

## 2. 核心指标
### 毛利 Gross Profit
用于表示净销售减产品与直接销售相关基础成本的结果。具体包含项必须版本化，禁止只写“毛利”不说明口径。

### 贡献利润 Contribution Profit
推荐作为经营动作比较的核心指标：net_sales - variable_costs。variable_costs可包含COGS、Amazon fees、fulfillment、广告、促销、退款损失、可归属仓储等，按定义版本明确。

### 贡献利润率
contribution_profit / net_sales。分母为0时返回undefined/null。

### 单位贡献利润
unit_net_revenue - unit_variable_costs。

### 净利润/经营净收益
只有当需要纳入的固定成本、税费及其他成本口径完整时才允许使用“净利润”标签；否则应使用贡献利润或estimated operating result。

## 3. 广告相关
- ACOS = ad_spend / attributed_sales，是广告效率；
- TACOS等总销售广告占比若使用，必须说明总销售口径；
- 广告可承受成本应从单位经济与目标利润反推，而不是把一个固定ACOS当普适目标。

## 4. 促销相关
折扣、Coupon、Deal费用和参考价影响必须分开记录。促销后销售增长不自动等于利润增长。

## 5. 退款与退货
refund_rate、refund_loss、return_processing/不可回收损失等需与销售窗口匹配，避免把滞后退款全部归入错误周期。

## 6. 仓储
仓储费可按期间总额和单位分摊观察；分摊算法必须记录。库存积压导致的未来仓储风险与已发生费用分离。

## 7. 数据质量
每次利润计算至少输出completeness、estimated_components、missing_components、source_refs、definition_version和confidence。