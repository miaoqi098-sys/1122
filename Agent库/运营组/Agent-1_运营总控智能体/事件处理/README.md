# Agent-1 事件处理

## 1. 模块定位
`事件处理/` 负责把已经通过 S01 基本校验的标准事件组织成可持续管理的事件流：去重、合并、关联、生命周期、升级、解决与关闭。

本模块不重新做 S01 结构校验，不替代 S03 冲突检测，不替代 S04 业务事项排序，也不直接形成 FinalDecision。

## 2. 正式链路
```text
原始 Event
→ S01 EventValidation / normalized_event
→ 事件处理：去重 / 合并 / 关联 / 生命周期 / 解决证据
→ ProcessedEvent
→ DecisionItemBuilder
→ S03 / S04 ...
```

`ProcessedEvent.schema.json` 是当前事件处理模块的标准输出契约。它负责承载事件治理结果，不改变原始 Event 的事实历史。

## 3. 与 S01 边界
S01 只做结构、基本字段和重复/近重复初筛并输出 duplicate_signal。事件处理模块负责：
- 判断是否真正重复；
- 是否更新已有事件；
- 是否合并为事件组；
- 是否保留独立事件但建立关联；
- 是否需要解决、关闭或重新打开既有事件；
- 为后续 DecisionItemBuilder 提供标准化事件治理结果。

## 4. 与 S04 边界
`event.severity` 表示事件本身的严重/紧急信号，不等于 S04 的 `business_priority`。

S04 排序的是 DecisionItem，必须综合经营治理层、状态、证据、依赖、影响范围、机会/风险时间窗口和资源。P0 Event 通常会提高对应待决事项优先级，但不是 `event P0 = DecisionItem P0` 的机械映射。

> 注：目标系统目前存在 `goal_layer` 与经营治理层语义冲突，事件模块在该冲突解决前不得自行扩展 `goal_layer` 新含义；相关记录见系统冲突问题库 `CONFLICT-A1-TARGET-001`。

## 5. 标准事件处理结果
ProcessedEvent 至少应能表达：
- `event_id`；
- `event_status`；
- `processing_disposition`；
- `transition_type`；
- `canonical_event_id`；
- `duplicate_of / merged_into`；
- `related_event_ids / relation_records`；
- `parent_event_id`；
- `scope`；
- `severity`；
- `event_fingerprint`；
- `escalation_reason`；
- `source_refs / evidence_refs`；
- `first_seen_at / last_seen_at / resolved_at / closed_at`；
- `resolution_basis / resolution_evidence_refs / validation_refs`；
- `reopen_reason`（适用时）。

## 6. 三类概念必须分离
### event_status｜长期状态
`open / monitoring / resolved / closed`

### processing_disposition｜本次处理结论
`new_event / exact_duplicate / near_duplicate / update_existing / merged / related_not_duplicate`

### transition_type｜本次状态转换动作
`create / update / resolve / close / reopen / none`

不得再把 `merged`、`duplicate`、`updated`、`reopened` 与长期事件状态混为同一个枚举。

## 7. 去重候选与最终判断
事件处理允许生成 `event_fingerprint` 作为候选索引，用于快速找到可能重复的历史事件；fingerprint 只能缩小候选范围，不能直接决定 `exact_duplicate`。最终去重仍必须结合 scope、核心事实、时间窗口、新证据、severity、风险/机会变化等判断。

## 8. 事件关系
事件关系必须区分：
- 对称关系，例如 `same_scope / conflicting_evidence`；
- 有向关系，例如 `dependency / follow_up / parent_child_scope / causal_candidate`。

关系记录需显式保留 direction、inverse_relation（适用时）和 relation_status。

## 9. 解决与关闭
事件 resolved/closed 必须有正向解决证据。Task completed、Decision completed 或时间经过均不能自动推断 Event resolved。

详细规则见 `事件关闭与解决证据.md`。

## 10. 文件结构
- `ProcessedEvent.schema.json`：事件处理标准输出契约。
- `事件优先级.md`：severity 语义、升级降级与 S04 边界。
- `事件去重规则.md`：重复/近重复判断与 fingerprint 候选索引。
- `事件合并规则.md`：事件聚合和源引用保留。
- `事件关联规则.md`：scope、因果、策略链、时间关系及关系方向。
- `事件生命周期.md`：event_status、processing_disposition 与 transition_type 分离。
- `事件关闭与解决证据.md`：resolved/closed 的正向证据门槛。
- `异常与升级.md`：冲突来源、延迟、对象缺失、无法归一等异常。
- `示例与验收.md`：静态场景验证。

## 11. 核心原则
- 去重不能删除证据历史；
- fingerprint 只负责候选检索，不替代最终去重判断；
- 合并不能把不同问题粗暴平均；
- 同一事实重复上报不能无限创建新决策链；
- 事件严重度与经营事项业务优先级分离；
- 状态、处理结论、状态转换必须分离；
- 已关闭事件只有出现新证据/新发生事实才允许 reopen；
- Event resolved 必须有解决证据，不能由 Task completed 机械推导；
- 事件关系必须可追溯且方向明确。

## 12. 当前人工排查状态
本模块正在人工逐项排查与完善，历史自动化的 L3/“封板”结论仅作为历史建设记录，不作为当前人工最终验收结论。
