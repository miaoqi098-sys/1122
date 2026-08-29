# 风险等级与资格门

## 目标
把风险判断转换为 Agent-1 可消费的资格结果，使高风险动作在进入方案选择/执行前被正确阻断、审批或附加控制。

## 风险等级
- `info`：仅记录，无当前行动约束；
- `low`：轻微风险，可在控制下继续；
- `medium`：需要补充检查或控制措施；
- `high`：可能导致停售、处罚、重大损失或消费者风险，需要审批/整改；
- `critical`：账户、严重安全、明确禁限售、重大知识产权等高影响风险，默认阻断相关动作。

## 资格状态
与 Agent-1 决策规则对齐：
- `prohibited`：当前证据下不可进入可执行候选；
- `requires_approval`：需人工/指定审批节点；
- `requires_more_evidence`：证据或规则不足；
- `eligible_with_controls`：满足指定控制后可继续；
- `eligible`：未发现阻断性风险。

## 资格门输入
- applicable_rule_refs；
- factual_evidence；
- evidence_freshness；
- risk_severity；
- scope；
- proposed_action；
- required_documents；
- unresolved_conflicts。

## required_controls 示例
- 删除/修改高风险claim；
- 补充认证/检测/授权文件；
- 限定marketplace或目标人群；
- 增加警示/标签；
- 暂停促销/投放直到资格恢复；
- 先完成账户健康/商品状态复核；
- 人工审批。

## 决策原则
1. 无最新适用规则时，不轻易给 `eligible`；
2. 明确禁限售/账户重大风险优先于增长和效率目标；
3. 风险等级与业务优先级分离：severity不是S04最终经营priority；
4. 风险解除必须有新证据或规则变化；
5. 资格门只决定“能否/在何控制下继续”，最终选哪个经营方案仍由Agent-1完成。
