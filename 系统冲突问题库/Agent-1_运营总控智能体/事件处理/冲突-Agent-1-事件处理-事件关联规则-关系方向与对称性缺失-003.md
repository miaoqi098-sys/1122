# CONFLICT-A1-EVENT-003

- 当前状态：已解决
- 严重级别：P2
- 发现来源：Agent-1 / 事件处理人工排查
- 主要问题路径：`Agent库/运营组/Agent-1_运营总控智能体/事件处理/事件关联规则.md`
- 关联路径：`事件处理/ProcessedEvent.schema.json`

## 冲突描述
旧规则仅使用 source_event_id / target_event_id / relation_type，没有明确哪些关系对称、哪些有向，也没有统一 dependency 的方向语义，容易导致关系图和不同模块反向解释。

## 解决方法
增加 `direction / inverse_relation / relation_status`；明确 same_scope、conflicting_evidence 等对称关系，以及 dependency、follow_up、parent_child_scope、causal_candidate 等有向关系；统一 `source dependency target` 表示 source 依赖 target。

## 实际修改记录
- `事件处理/事件关联规则.md`
- `事件处理/ProcessedEvent.schema.json`
- `事件处理/示例与验收.md`

## 验证结果
静态语义与 Schema 已一致。

## 解决日期
2026-08-30
