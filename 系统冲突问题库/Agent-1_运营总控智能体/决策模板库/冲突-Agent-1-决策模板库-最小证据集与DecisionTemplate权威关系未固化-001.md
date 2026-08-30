# CONFLICT-A1-TEMPLATE-001

- 当前状态：已确认
- 严重级别：P2
- 主要问题路径：`Agent库/运营组/Agent-1_运营总控智能体/决策模板库/`
- 关联路径：`决策规则/`、`决策模板库/DecisionTemplate.schema.json`

## 冲突描述
决策规则中的 Minimum Evidence Set 与 DecisionTemplate 已有 required_context、required_metrics、required_evidence 等结构高度重合，但两者的权威关系和门槛覆盖规则尚未正式固化。

## 建议解决方案
明确：决策规则负责证据治理原则；DecisionTemplate 负责具体业务场景的最小证据定义；治理规则可以提高门槛，但不得隐式降低模板 required 项。

## 实际修改记录
尚未修改正式 Agent库 文件。

## 验证结果
待验证。

## 解决日期
未解决。
