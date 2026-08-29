# 工具与数据需求

## 目标
定义 Agent-10 完成价格状态、参考价、促销资格与方案分析所需的数据和未来工具能力；当前不实现真实价格/促销操作。

## 核心数据
1. 前台价格展示：当前报价、Buy Box、参考价/Was Price/List Price展示、Coupon/Deal展示；
2. 后台价格配置：常规价、sale price、促销配置；
3. 订单层成交价：实际订单价格、优惠、促销归因；
4. 价格历史：前台/后台/订单层时间序列；
5. 活动规则与资格：marketplace、promotion type、规则版本、生效时间；
6. 促销历史：Coupon、Deal、Promotion Code等生命周期；
7. Agent-6利润约束；
8. Agent-7库存覆盖与活动承接；
9. Agent-3竞品价格、Agent-8市场趋势；
10. Agent-9转化与内容准备状态。

## 最低字段
- price/promotion type；
- scope；
- marketplace；
- amount/discount/currency；
- observed_at / valid_from / valid_to；
- buyer_condition；
- source；
- rule_version_ref；
- evidence_ref；
- freshness。

## 数据降级
- 无订单实际成交价：只能做理论优惠分析，叠加风险降低置信度；
- 无最新活动规则：eligibility=`unknown/needs_rule_verification`；
- 无前台展示采集：不能确认参考价/促销是否真正展示；
- 无利润约束：不得给最终折扣可行性；
- 无库存约束：高流量活动不得给确定性推荐。

## 未来工具能力
- 前台价格/促销展示采集；
- 后台价格/促销读取；
- 订单成交价与优惠解析；
- 价格历史持久化；
- 平台规则/资格数据源；
- 活动日历；
- Schema验证；
- 价格/促销执行接口。

## 运行依赖
复用R03、R04、R06、R08、R12；平台活动规则/资格若无法由既有接口覆盖，未来可扩展独立规则数据源，但当前先作为工具需求，不新增重复依赖。
