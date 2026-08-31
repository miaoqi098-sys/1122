# Agent-3｜竞品快照模型

## 1. 目的
竞品快照用于保存“某个竞争实体在某个时间点、某个marketplace、某个可比上下文下的事实状态”，为变化检测提供稳定基线。

## 2. 核心对象
正式结构见 `CompetitorSnapshot.schema.json`。

最关键字段：
- snapshot_id
- competitor_entity_id
- entity_type / entity_ref
- marketplace
- our_scope_refs[]
- relationship_types[]
- observed_at / data_window
- facts
- search_contexts[]
- source_refs[] / source_types[]
- confidence / freshness
- comparison_eligible
- comparison_blockers[]
- missing_data[]

## 3. 可比原则
只有 `comparison_eligible=true` 的快照才能直接做变化比较。

以下任一情况应阻止直接比较：
- marketplace不同；
- 搜索关键词/类目上下文不同且变化依赖该上下文；
- 数据源口径发生无法校准的变化；
- 时间点过旧；
- 页面/工具异常导致事实不完整；
- 竞品实体本身被错误映射。

## 4. 快照不是结论
快照只保存事实，不保存最终经营决策。推断、竞争信号和事件必须在检测规则阶段生成，并保留对原快照的引用。

## 5. unknown与缺失
字段缺失时使用missing_data记录，不用模型猜测填充。多个来源冲突时可以在facts中保留多来源值，并降低confidence或标记comparison_blockers。

## 6. 时间序列
历史快照不得被最新快照覆盖。变化检测至少保留：current_snapshot_id、baseline_snapshot_id、比较窗口与关系版本。