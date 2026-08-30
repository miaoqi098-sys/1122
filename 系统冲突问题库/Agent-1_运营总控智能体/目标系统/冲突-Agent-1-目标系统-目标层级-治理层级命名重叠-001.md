# CONFLICT-A1-TARGET-001

- 冲突名称：Agent-1 / 目标系统 / 目标层级与治理层级命名重叠
- 当前状态：已确认
- 严重级别：P1
- 发现来源：Agent-1 跨模块一致性人工排查
- 主要问题路径：`Agent库/运营组/Agent-1_运营总控智能体/目标系统/`
- 关联路径：
  - `目标系统/目标层级.md`
  - `目标系统/目标优先级.md`
  - `技能模块/S04_决策排序/`
  - `技能模块/统一接口/DecisionItem.schema.json`

## 冲突描述
系统当前存在两套不同语义的“四层结构”，但均被表述为目标层级：

1. 目标因果层级：最终经营目标 → 中间经营目标 → 执行目标 → 过程指标。
2. 经营治理优先层：safety_sellability → survival_operations → business_quality → growth_expansion。

`DecisionItem.goal_layer` 当前实际承载第二套治理优先层，容易与第一套目标因果层混淆。

## 影响范围
会影响 DecisionItem、S04 排序、目标系统解释、决策模板以及未来机器接口的字段语义一致性。

## 根因
同一个 `goal_layer/目标层级` 名称被用于表达两个正交维度。

## 建议解决方案
拆分为两个正式对象：
- `goal_hierarchy`：final / intermediate / execution / process；
- `governance_layer`：safety_sellability / survival_operations / business_quality / growth_expansion。

`DecisionItem.goal_layer` 应评估迁移为 `governance_layer`，并同步所有上下游引用。

## 实际修改记录
尚未修改正式 Agent库 文件。

## 验证方法
检查目标系统、DecisionItem、S04、DecisionSelector、决策模板是否使用唯一且一致的字段语义。

## 验证结果
待验证。

## 解决日期
未解决。
