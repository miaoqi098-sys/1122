# CONFLICT-A1-EVENT-002

- 当前状态：已解决
- 严重级别：P1
- 发现来源：Agent-1 / 事件处理人工排查
- 主要问题路径：`Agent库/运营组/Agent-1_运营总控智能体/事件处理/事件生命周期.md`
- 关联路径：`事件处理/README.md`、`事件处理/ProcessedEvent.schema.json`

## 冲突描述
旧生命周期把 `open / updated / resolved / closed / reopened` 与 `suppressed_duplicate / merged` 混在同一状态体系中，导致长期状态、处理结论、状态转换动作语义冲突。

## 解决方法
正式拆为：
- `event_status`：open / monitoring / resolved / closed；
- `processing_disposition`：new_event / exact_duplicate / near_duplicate / update_existing / merged / related_not_duplicate；
- `transition_type`：create / update / resolve / close / reopen / none。

并同步 README、ProcessedEvent Schema、生命周期和验收示例。

## 实际修改记录
- `事件处理/ProcessedEvent.schema.json`
- `事件处理/README.md`
- `事件处理/事件生命周期.md`
- `事件处理/示例与验收.md`
- `事件处理/总验收记录.md`

## 验证结果
静态规则与 Schema 已一致；动态状态机运行测试留待运行层。

## 解决日期
2026-08-30
