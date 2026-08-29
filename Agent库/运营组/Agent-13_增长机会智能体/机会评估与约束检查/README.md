# 机会评估与约束检查

## 目标
在机会进入Agent-1决策候选前，检查“增长空间存在”是否同时满足利润、库存、风险、资源与时序等基本可行条件。

## 必查约束
1. Agent-6 财务：贡献利润、break-even、预算/折扣可承受范围；
2. Agent-7 库存：覆盖天数、补货周期、供给承接；
3. Agent-12 风险：eligibility与required_controls；
4. Agent-2 商品状态：是否可售/稳定；
5. Agent-4/5：流量/广告是否有真实承接路径；
6. Agent-9：页面与转化是否准备好；
7. Agent-10：价格/促销是否冲突；
8. Agent-8：机会窗口与市场趋势是否仍有效；
9. 资源：预算、内容、库存、时间、人工审批和工具能力。

## 约束状态
- `clear`；
- `soft_constraint`；
- `hard_constraint`；
- `unknown_requires_evidence`。

任何Agent-12 `prohibited` 都是hard_constraint；不可用“高增长潜力”覆盖。

## 评估输出
- opportunity_id；
- impact_assessment；
- financial_constraint；
- inventory_constraint；
- risk_eligibility；
- execution_dependencies；
- timing_window；
- feasibility；
- unresolved_unknowns；
- go_to_agent1_status。

## go_to_agent1_status
- `not_ready`：关键证据/约束未完成；
- `ready_with_unknowns`：无硬阻断，但有明确不确定项；
- `ready`：证据和关键约束足够进入Agent-1方案选择；
- `blocked`：存在hard constraint/prohibited。

## 边界
Agent-13只做机会资格与可行性整理，不替Agent-1决定投入资源或改变策略链。
