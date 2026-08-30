# CONFLICT-A1-SELECTOR-001

- 当前状态：已确认
- 严重级别：P1
- 主要问题路径：`Agent库/运营组/Agent-1_运营总控智能体/技能模块/统一接口/`
- 关联路径：`决策规则/`、`输出规范/`、`技能模块/统一接口/DecisionSelector.output.schema.json`

## 冲突描述
决策规则已经定义 FinalDecision 的生命周期状态，但 DecisionSelector 输出契约中的 final_decision 尚无正式 decision_status 与状态转换字段。

## 影响范围
机器接口无法明确表达 pending_approval、active、superseded、expired 等决策生命周期状态。

## 建议解决方案
在 FinalDecision 权威 Schema/DecisionSelector 输出中补充 decision_status、status_reason、状态时间戳和 transition trigger，并统一输出规范。

## 实际修改记录
尚未修改正式 Agent库 文件。

## 验证结果
待验证。

## 解决日期
未解决。
