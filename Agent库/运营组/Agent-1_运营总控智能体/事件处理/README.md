# Agent-1 事件处理

## 1. 模块定位
`事件处理/` 负责把已经通过S01基本校验的标准事件组织成可持续管理的事件流：去重、合并、关联、生命周期、升级与关闭。

本模块不重新做S01结构校验，不替代S03冲突检测，不替代S04业务事项排序，也不直接形成FinalDecision。

## 2. 正式链路
```text
原始Event
→ S01 EventValidation / normalized_event
→ 事件处理：去重/合并/关联/生命周期
→ DecisionItemBuilder
→ S03/S04...
```

## 3. 与S01边界
S01只做重复/近重复的初筛并输出duplicate_signal。事件处理模块负责：
- 判断是否真正重复；
- 是否更新已有事件；
- 是否合并为事件组；
- 是否保留独立事件但建立关联；
- 是否需要关闭或重开既有事件。

## 4. 与S04边界
`event.severity` 表示事件本身的严重/紧急信号，不等于 S04 的 `business_priority`。

S04 排序的是 DecisionItem，必须综合目标层级、状态、证据、依赖和资源。P0事件通常会提高对应待决事项优先级，但不是“event P0 = DecisionItem必然P0”的机械映射。

## 5. 标准事件处理结果
事件处理后应尽量保留：
- event_id；
- event_status；
- canonical_event_id（若归并）；
- duplicate_of / merged_into；
- related_event_ids；
- parent_event_id；
- scope；
- severity；
- escalation_reason；
- source/evidence refs；
- first_seen_at / last_seen_at / resolved_at；
- reopen_reason（适用时）。

## 6. 事件状态
建议生命周期：
`open → updated → resolved → closed → reopened`

并允许 `suppressed_duplicate / merged` 作为归并状态。

## 7. 文件结构
- `事件优先级.md`：severity语义、升级降级与S04边界。
- `事件去重规则.md`：重复/近重复判断。
- `事件合并规则.md`：事件聚合和源引用保留。
- `事件关联规则.md`：scope、因果、策略链和时间关联。
- `事件生命周期.md`：状态、关闭和重开。
- `异常与升级.md`：冲突来源、延迟、对象缺失、无法归一等异常。
- `示例与验收.md`：静态场景验证。

## 8. 核心原则
- 去重不能删除证据历史；
- 合并不能把不同问题粗暴平均；
- 同一事实重复上报不能无限创建新决策链；
- 事件严重度与经营事项业务优先级分离；
- 已关闭事件只有出现新证据/新发生事实才允许重开；
- 事件关系必须可追溯。