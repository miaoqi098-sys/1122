# 运营组公共协议

## 定位
本目录定义 Agent-1 至 Agent-13 之间必须共享、但不属于任何单一专业 Agent 私有领域模型的静态协议。

当前第一项公共协议是“专业 Agent 领域事件 → Agent-1 标准智能事件包”的交接规范。

## 权威边界
- Agent-1 `输入规范/智能事件包.schema.json` 是进入 Agent-1 S01 及后续经营决策链的唯一标准 Event 合同。
- Agent-2 至 Agent-13 可以保留各自领域事件对象，用于表达广告、增长、库存、评价等专业语义。
- 领域事件不能因为字段名里含 `event` 就被直接当作 Agent-1 标准 Event 消费。
- 专业 Agent 向 Agent-1 主动上报前，必须完成规范化映射。
- `run_id / trace_id / parent_run_id` 属于未来运行调用信封，不属于业务 Event。

## 当前文件
- `专业Agent事件协议.md`：交接与规范化总则。
- `ProfessionalAgentEventHandoff.schema.json`：静态交接对象 Schema。
- `事件字段映射表.md`：公共字段、severity、confidence、scope、时间与证据映射规则。
- `L5公共对象与事件协议验收.md`：L5 静态门禁记录。
- `示例/Agent4广告事件交接.example.json`：领域广告事件映射为 Agent-1 Event 的示例。

## 设计原则
1. 不复制第二份 Agent-1 Event Schema。
2. 不为了统一而抹掉专业 Agent 的领域字段。
3. 统一的是“交接合同”，不是强迫所有内部对象同构。
4. 事实、解释、假设、建议必须分离。
5. severity 与 confidence 必须在交接时规范化并保留原始语义。
6. 任何未来真实规范化器/验证器实现属于运行依赖，不在本目录实现。