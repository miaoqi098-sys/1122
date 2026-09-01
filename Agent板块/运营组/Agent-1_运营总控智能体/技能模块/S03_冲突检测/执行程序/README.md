# S03 执行程序

当前正式运行器：`runtime.js`，版本 `S03-runtime-v1.2.0`。

## 运行组件
- `ContextElementNormalizer`：从S02 `context_package` 派生可比较元素；显式 `normalized_elements` 仅作为派生比较视图。
- `FactConflictDetector`：优先检测同口径事实冲突、单位/口径不可比问题。
- `InterpretationConflictDetector`：检测同一事实基础上的解释/假设分歧。
- `GoalConstraintDetector`：检测增长目标与库存、利润、Listing硬约束之间的张力。
- `StrategyConflictDetector`：检测执行中/观察窗口内任务与反向动作；是否允许策略反转交S10。
- `ConflictClusterer`：按共同根因去重、聚类。
- `EvidenceResolver`：只请求能改变判断的最小决定性证据。

## 运行原则
1. `context_package` 是唯一权威上下文源；`normalized_elements` 不得覆盖原事实。
2. 事实冲突优先于解释和策略冲突。
3. 数据缺失、失败、`null` 不得解释为0。
4. 单位或口径无法转换时，不直接比较数值。
5. Agent只记录为参与方，不是冲突类型。
6. `severity` 与 `decision_impact` 分开判断。
7. 不投票、不平均互相冲突的数据。
8. 正常非阻断输出进入 `DecisionItemBuilder`，S03不得直接生成S04 `DecisionItem`。
9. 策略反转冲突只检测并路由S10，不在S03内部裁决。
10. 本运行器不做最终经营取舍。

## V1.2范围
V1.2优先实现可解释、确定性的事实/任务/策略/约束/资源承受能力规则；无法可靠判断的语义冲突保留为证据请求，不使用猜测补全。