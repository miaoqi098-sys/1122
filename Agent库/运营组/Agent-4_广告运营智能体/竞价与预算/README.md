# Agent-4｜竞价与预算建议

## 1. 定位
Agent-4可以提出竞价、预算、placement和投放节奏建议，但这些属于广告专业建议，不是最终经营决策。任何提高总花费上限、牺牲利润换规模或跨产品转移预算的动作必须交Agent-1结合Agent-6/Agent-7/Agent-10等约束判断。

## 2. 竞价建议输入
至少考虑：广告类型、实体层级、当前bid、placement adjustment、impressions、clicks、CPC、CVR、ACOS/ROAS、订单/销售、搜索词质量、预算状态、current_window、baseline_window、数据完整性与归因延迟。

## 3. 竞价建议类型
- increase_bid_candidate：优质目标受竞价限制且效率允许；
- decrease_bid_candidate：CPC/花费压力上升且转化/价值不足；
- hold_bid：证据不足或策略变更仍在观察窗口；
- isolate_bid：同一结构内流量价值差异过大，需要拆出独立控制；
- placement_adjustment_candidate：仅在placement证据足够时提出。

禁止仅以ACOS单指标直接计算机械竞价。

## 4. 预算诊断
区分：
- budget_limited：有效流量因预算上限被截断；
- inefficient_budget_consumption：预算被低效流量过早消耗；
- budget_idle：有预算但缺少流量/竞争力；
- pacing_imbalance：日内或周期内投放节奏失衡；
- allocation_imbalance：预算集中在低价值结构，高价值结构受限。

## 5. 预算建议规则
增加预算前至少确认：效率/增长证据、库存可承接、利润/现金流边界、活动价格背景、观察窗口。预算耗尽本身不是加预算理由。

降低预算或收缩前需区分：真实低效、短期归因延迟、库存/价格/Listing变化、季节性和新广告学习期。

## 6. 变更幅度
框架层只定义change_direction与change_band，不固化通用百分比。建议字段：
- direction: increase / decrease / hold / reallocate；
- magnitude_band: small / medium / large；
- rationale；
- evidence_refs；
- expected_effect；
- risk；
- observation_window；
- rollback_condition；
- requires_approval。

具体百分比应由配置、历史弹性与目标约束决定，不写死为普适规则。

## 7. 观察窗口与防抖
竞价/预算变更后不得立即按同一指标反向调整。需记录change_at、old_value、new_value、expected_effect、minimum_observation_window、validation_metrics。重大反向建议需标记strategy_reversal并交Agent-1/S10类防抖机制判断。

## 8. 风险边界
以下建议必须升级：
- 可能突破产品利润底线；
- 库存不足仍建议扩量；
- 促销/价格即将变化导致历史广告数据失真；
- 预算从一个ASIN大量迁移至另一个ASIN；
- 大幅改变已稳定策略链。

## 9. 输出
Agent-4输出候选动作、证据、风险和观察要求；是否执行由Agent-1最终决策链决定。