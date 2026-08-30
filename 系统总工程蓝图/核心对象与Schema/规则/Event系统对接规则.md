# Event 系统级对接规则 V1

## 1. Canonical 决定
总工程不新建第二套 Event 核心 Schema。

当前系统级 Canonical 入站事件继续使用：
`Agent库/运营组/Agent-1_运营总控智能体/输入规范/智能事件包.schema.json`

Agent-1 处理后的事件生命周期对象继续使用：
`Agent库/运营组/Agent-1_运营总控智能体/事件处理/ProcessedEvent.schema.json`

专业 Agent 的领域事件继续通过：
`Agent库/运营组/公共协议/专业Agent事件协议.md`
进行 Domain Event → Canonical Event 规范化。

## 2. 总工程引用语义
- `event_id`：跨 Decision / Goal / Task / Action / Memory 的业务事件主引用。
- 产品级事件必须携带 `product_id`；ASIN 仅作为外部辅助标识。
- `source_ref` / `evidence_refs`：保留来源与证据，不替代 event_id。
- `related_events` / `parent_event_id`：表达业务关联，不代表任务依赖。
- Event 状态与 Task 状态独立；Task completed 不得自动令 Event resolved。
- Event resolved 必须遵循 ProcessedEvent 的 resolution_basis / resolution_evidence_refs / validation_refs。

## 3. 与总工程对象关系
```text
MetricSnapshot / BusinessState
        ↓
Domain Signal / Domain Event
        ↓
Canonical Intelligent Event
        ↓
ProcessedEvent
        ↓
DecisionItem / FinalDecision
        ↓
Goal / Task
        ↓
Action / ExecutionResult
        ↓
ValidationResult
        ↓
Event resolution / Memory
```

## 4. 重要边界
- 专业 Agent 可以保留专业 Domain Event Schema，但不得另造跨域最终事件主键。
- Agent-1 仍是跨域最终经营决策出口；Event 本身不是 FinalDecision。
- 推荐项不能伪装成事实；facts 与 recommendation 分离。
- Runner 的 run_id / trace_id 不进入业务 Event 主键体系。

## 5. UI 映射
首页“重点异常与机会”读取 Event / ProcessedEvent 的业务投影；不是直接读取模型日志。
建议 UI 聚合层使用：event_id、product_id、event_type/category、severity、summary、event_status、occurred_at、last_seen_at、evidence_refs、visibility/importance（后续聚合层字段）。

## 6. 运行依赖
真实事件规范化器、事件存储、去重索引、消息总线、Signal Detector 属于运行实现，当前仅登记运行依赖。