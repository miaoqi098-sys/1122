# S03｜冲突检测

## 技能定位
S03接收S02的ContextPackage，将其中事实、分析、目标、任务、策略和约束标准化为可比较的冲突元素，识别真正会影响Agent-1决策的矛盾。

## 正式调用位置
```text
S02 ContextPackage
↓
S03 ConflictDetection
↓
Conflict[] / ConflictGroup[]
↓
DecisionItemBuilder
↓
Canonical DecisionItem[]
↓
S04
```

S03不再把`conflicts`直接当作S04的`decision_items`。
正常非阻断输出应路由：
`continue_to_decision_item_builder`。

## 唯一上下文源
S03正式输入以`context_package`为唯一权威上下文源。
`normalized_elements`只是从ContextPackage派生的比较视图，不得覆盖原上下文语义。

## 正式冲突类型
- fact
- interpretation
- goal
- task
- strategy
- time_horizon
- constraint

Agent是冲突参与方，不是冲突类型。

## 决策影响
- none
- confidence_only
- changes_ranking
- blocks_decision
- requires_escalation

`changes_ranking`表示该冲突可能影响后续DecisionItem/S04排序，不代表S03直接排序。

## 冲突聚类
使用：
- conflict_group_id
- root_conflict
- related_conflicts

多个Agent意见不同，应尽量找到底层经营矛盾，而不是按Agent投票。

## 与DecisionItemBuilder边界
S03负责回答：
> 有什么矛盾？矛盾影响多大？缺什么证据？

DecisionItemBuilder负责回答：
> 这些事件、上下文和冲突最终形成哪些正式待决事项？

S03不得自己生成或排序DecisionItem。

## 与S10边界
- S03识别新旧策略存在冲突；
- S10判断新证据是否足以改变正在运行的StrategyChain。

S03不裁决观察窗口内是否应该提前反转。

## 不负责
- 多数投票；
- 平均Agent结论；
- 生成最终方案；
- 最终优先级；
- 直接覆盖旧策略。

## 当前版本
- 业务规则：V1.2；
- 接口：V1.2，已统一ContextPackage并正式接DecisionItemBuilder；
- Runtime（运行时）：`S03-runtime-v1.2.0`，确定性规则优先；
- 系统运行桥：接入中。