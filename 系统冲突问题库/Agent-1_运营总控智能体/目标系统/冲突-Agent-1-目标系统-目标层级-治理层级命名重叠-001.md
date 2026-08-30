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
  - `事件处理/事件合并规则.md`
  - `事件处理/README.md`

## 冲突描述
系统当前存在两套不同语义的“四层结构”，但均被表述为目标层级：

1. 目标因果层级：最终经营目标 → 中间经营目标 → 执行目标 → 过程指标。
2. 经营治理优先层：safety_sellability → survival_operations → business_quality → growth_expansion。

`DecisionItem.goal_layer` 当前实际承载第二套治理优先层，容易与第一套目标因果层混淆。

本轮人工排查 `事件处理/` 时进一步确认该冲突已经向事件合并规则扩散：旧规则曾使用“不同 goal_layer”作为不合并条件，但该字段本身语义尚未统一。

## 影响范围
会影响 DecisionItem、S04 排序、目标系统解释、决策模板、事件处理/事件合并以及未来机器接口的字段语义一致性。

## 根因
同一个 `goal_layer/目标层级` 名称被用于表达两个正交维度。

## 建议解决方案
拆分为两个正式对象：
- `goal_hierarchy`：final / intermediate / execution / process；
- `governance_layer`：safety_sellability / survival_operations / business_quality / growth_expansion。

`DecisionItem.goal_layer` 应评估迁移为 `governance_layer`，并同步所有上下游引用。

## 已执行的防扩散处理
事件处理模块已停止把 `goal_layer` 作为唯一事件合并判断字段，并在 README/合并规则中显式引用本冲突记录；该动作只防止冲突继续扩散，不代表根冲突已解决。

## 实际修改记录
- `Agent库/运营组/Agent-1_运营总控智能体/事件处理/README.md`
- `Agent库/运营组/Agent-1_运营总控智能体/事件处理/事件合并规则.md`

目标系统、DecisionItem、S04 等根路径尚未统一修改。

## 验证方法
检查目标系统、DecisionItem、S04、DecisionSelector、决策模板、事件处理是否使用唯一且一致的字段语义。

## 验证结果
事件处理端已完成防扩散；根冲突待解决。

## 解决日期
未解决。
