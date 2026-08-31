# Agent-1 输入规范

## 1. 模块定位

`输入规范/` 定义 Agent-1 可以接收哪些类型的输入、每类输入最低需要什么字段、如何进入 S01/S02，以及如何保留来源和追溯关系。

本模块不负责判断输入内容是否正确，不替代 S01 事件校验，不替代 S02 上下文装载，也不直接把所有输入都包装成同一种事件。

## 2. 输入类型

Agent-1 正式输入分为四类：

1. **标准事件 Event**：来自专业 Agent、系统监控、人工触发或其他合法来源，进入 S01 校验。
2. **专业 Agent 结构化结果**：通常由 Agent-1 发起请求后返回，可作为后续事件事实、上下文证据或决策依赖输入。
3. **人工输入**：用户/运营人员给出的目标、约束、确认、审批、修正或业务指令；需标明来源和是否为事实/偏好/授权。
4. **系统输入**：调度、执行、监控、状态变化、Schema校验、工具失败等系统级事件或回执；不得伪装成专业经营结论。

## 3. 与 S01 / S02 的边界

```text
原始输入
↓
按来源类型映射
↓
若属于 Event → S01 EventValidation
↓
S01.normalized_event
↓
S02 ContextLoading
↓
ContextPackage
```

S02 只把 `S01.normalized_event` 作为正式事件输入，不重新读取未经 S01 标准化的原始 Event。

专业 Agent 结果、人工确认、历史记录和系统状态可以由 S02 按需装载进 ContextPackage，但必须保留 source_ref / request_id / evidence_ref 等引用，不能变成无来源事实。

## 4. 统一作用域

正式 Event 支持：
- product
- parent_product
- sku
- account
- store
- global

规则：
- product / parent_product / sku 必须提供可解释的 `product_id` 或对应对象引用；
- account / store / global 不要求伪造 product_id；
- `scope_id` 与 `scope_objects` 用于表达实际影响对象；
- 禁止为了兼容旧Schema给账户级事件伪造 ASIN。

## 5. 统一追溯

输入至少应尽量保留：
- `event_id` / `request_id` / `input_id`；
- `source_type`；
- `source_agent` 或 `source_actor`；
- `source_ref` / `evidence_refs`；
- `trace_id`（运行时有值时）；
- `parent_event_id` / `related_events`（适用时）；
- `occurred_at` / `received_at`；
- freshness / confidence / data_window（适用时）。

`run_id / trace_id` 属于运行调用追踪，不应被错误当作经营业务主键。

## 6. 输入最低质量原则

- 不把“未知”填成默认值；
- recommendation 不是 Event 的硬必填事实；
- product_id 不是 account/store/global Event 的硬必填；
- 事实、解释、建议和授权必须区分；
- 专业 Agent 无法可靠回答时必须返回证据不足/缺失数据；
- 人工输入若属于偏好或授权，不得被伪装成客观事实；
- 系统错误/工具失败不得被解释成指标为0。

## 7. 文件结构

- `智能事件包.schema.json`：Agent-1 接收的标准 Event 框架Schema。
- `专业Agent结果.schema.json`：专业 Agent 结构化返回Schema。
- `人工与系统输入.md`：非专业Agent输入来源和进入链路规则。
- `统一引用关系.md`：source/trace/parent/evidence引用规则。
- `ContextPackage边界.md`：Event 与上下文事实源的边界。
- `示例与验收.md`：多作用域、多来源静态示例与验收。

## 8. 当前阶段

本模块只定义框架输入协议。真实消息队列、Webhook、Agent Runner、Schema Validator、权限系统和数据接入仍属于运行/共享基础设施。