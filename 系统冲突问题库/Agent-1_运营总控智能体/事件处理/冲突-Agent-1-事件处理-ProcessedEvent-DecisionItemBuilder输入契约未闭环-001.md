# CONFLICT-A1-EVENT-001

- 当前状态：待验证
- 严重级别：P1
- 发现来源：Agent-1 / 事件处理人工排查
- 主要问题路径：`Agent库/运营组/Agent-1_运营总控智能体/事件处理/`
- 关联路径：
  - `事件处理/ProcessedEvent.schema.json`
  - `技能模块/统一接口/DecisionItemBuilder.input.schema.json`
  - `技能模块/统一接口/DecisionItemBuilder.output.schema.json`
  - `技能模块/S01_事件校验/`

## 冲突描述
事件处理原先没有正式输出对象，链路表现为 `S01 normalized_event → 事件处理 → ??? → DecisionItemBuilder`。本轮已在事件处理模块新增 `ProcessedEvent.schema.json`，但 DecisionItemBuilder 的正式输入契约尚未同步声明或验证对 ProcessedEvent 的依赖，因此跨模块闭环仍未完成。

## 已执行解决动作
- 新增 `事件处理/ProcessedEvent.schema.json`；
- README 正式链路改为 `normalized_event → 事件处理 → ProcessedEvent → DecisionItemBuilder`；
- 合并规则和示例已引用 ProcessedEvent。

## 剩余解决动作
排查并同步 DecisionItemBuilder 输入契约及相关统一接口，确保 ProcessedEvent 字段可被正式消费而不是依赖隐式 additionalProperties。

## 验证方法
对照 ProcessedEvent 与 DecisionItemBuilder input/output Schema，验证 canonical_event、evidence/source refs、scope、severity、relation、resolution 等字段的正式映射。

## 验证结果
事件处理端已完成；跨模块尚待验证。

## 解决日期
未完全解决。
