# 专业 Agent 事件交接协议 V1.0

## 1. 目的
解决 Agent-2 至 Agent-13 专业领域事件对象与 Agent-1 标准智能事件包字段不完全同构的问题，同时保留专业语义。

## 2. 两层事件模型
### A. Domain Event
由专业 Agent 自己定义，例如 `AdvertisingIntelligenceEvent`、`GrowthOpportunityEvent`。它可以拥有领域专用字段、状态机和专业枚举。

### B. Canonical Event
必须通过 `Agent-1_运营总控智能体/输入规范/智能事件包.schema.json`。只有该对象允许进入 Agent-1 的 S01 → S09 业务链。

关系：
`Domain Event → 规范化映射 → Canonical Intelligent Event → Agent-1`

若专业 Agent 本身直接生成符合 Agent-1 标准的 Event（如 Agent-2 当前模式），可以省略独立 Domain Event，但仍视为遵循本协议。

## 3. 交接对象
静态交接使用 `ProfessionalAgentEventHandoff`，至少保留：
- protocol_version
- source_agent
- domain_schema
- domain_event_id
- domain_event
- canonical_event
- normalization_notes

Agent-1 真正消费的是 `canonical_event`；`domain_event` 用于证据追溯、复盘和领域细节保留。

## 4. ID规则
- `canonical_event.event_id` 是 Agent-1 业务链主 Event ID。
- 原领域事件 ID 必须保留在 `domain_event_id`，并推荐同步到 `canonical_event.source_ref`。
- 同一个领域事件的更新不得无故生成多个等价 canonical event；优先沿用已有 event_id 并更新证据/状态，恢复事件可通过 related_events 关联。

## 5. 事实与建议分离
- `facts[]` 只能包含可证实事实。
- diagnosis / hypothesis / interpretation 不得伪装成 facts。
- recommendation / recommendation_candidates 只能作为可选建议，不构成 Agent-1 FinalDecision。
- 专业 Agent 不得通过交接对象直接创建执行任务。

## 6. Scope
领域对象中的 scope 必须映射到 Agent-1 的：
`scope_type + scope_id + scope_objects + product_id/asin（适用时）`。

如果领域对象同时涉及 campaign、keyword、product 等多个对象：
- Canonical Event 的主 scope 选择本事件主要经营对象；
- 其他受影响对象放入 `scope_objects`；
- 不得为同一事实仅因对象层级不同而重复制造多个等价 Event。

## 7. Severity
Agent-1 唯一入站等级为 `P0/P1/P2/P3`。专业 Agent 可以保留自身 severity 枚举，但交接时必须转换，且 `metadata.original_severity` 保留原值。

默认语义映射：
- critical → P0
- high → P1
- medium → P2
- low / info → P3

专业领域若没有 severity 字段，应依据本 Agent 已定义的影响/紧急度规则生成 P0-P3；证据不足不得人为升高严重度。

## 8. Confidence
Agent-1 使用 0–1 数值。
- 专业 Agent 已为 0–1 数值：直接保留。
- 专业 Agent 使用 low/medium/high：交接层规范化为代表值 low=0.35、medium=0.65、high=0.85，并在 `metadata.original_confidence` 保留原标签。
- 该转换只是接口归一化，不代表改变专业 Agent 的判断逻辑。

## 9. 时间
领域时间字段按语义映射：
- observed_at / detected_at → occurred_at
- generated_at：若没有更早的事实发生时间，可作为 occurred_at；否则保留在 metadata
- Agent-1 接收时间 → received_at
- current_window / baseline_window 的完整结构保留在 metadata.domain_payload；可摘要到 data_window。

## 10. 证据
- evidence_refs 优先原样透传。
- 没有证据引用的高置信/高严重度专业事件不得直接升级为确定性 Canonical Event。
- 领域原对象可以完整保留在 `metadata.domain_payload`，但不得依赖 metadata 才能理解 Canonical Event 的基本事实。

## 11. 运行字段隔离
`run_id / trace_id / parent_run_id / retry_count` 等属于 Skill/Agent Runner 调用信封，不写入业务事件主字段。未来运行层可以在调用上下文中关联，但不可把运行追踪 ID 当业务对象主键。

## 12. 兼容与演进
- 新专业 Agent 或新领域事件 Schema 必须先证明可映射到 Canonical Event。
- 新增领域字段不要求修改 Agent-1 Event Schema，除非出现多个 Agent 都无法通过现有公共字段表达的稳定跨域语义。
- 修改 Agent-1 Canonical Event 属于高影响协议变更，需单独版本治理和跨 Agent 回归检查。

## 13. 非运行实现
本文件定义静态合同，不实现真实 normalizer、Schema Validator 或消息总线。真实转换执行能力记录到 `临时建设任务/运行依赖待办.md`。