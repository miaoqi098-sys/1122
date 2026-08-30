# CONFLICT-A1-EVENT-004

- 当前状态：已解决
- 严重级别：P2
- 发现来源：Agent-1 / 事件处理人工排查
- 主要问题路径：`Agent库/运营组/Agent-1_运营总控智能体/事件处理/事件去重规则.md`
- 关联路径：`事件处理/ProcessedEvent.schema.json`

## 冲突描述
旧规则要求结合 scope、event_type、核心事实、时间窗口等判断重复，但缺少稳定的候选索引机制。真实运行时若每次遍历全部历史事件，将导致去重规则难以工程化。

## 解决方法
新增 `event_fingerprint / fingerprint_version` 概念，采用“两阶段去重”：fingerprint 只负责候选检索，最终 exact_duplicate 仍由事件处理结合新证据、scope、时间窗口、风险/机会变化等判断。明确禁止 fingerprint 相同即自动合并。

## 实际修改记录
- `事件处理/事件去重规则.md`
- `事件处理/ProcessedEvent.schema.json`
- `事件处理/README.md`
- `事件处理/示例与验收.md`

## 验证结果
静态规则与 Schema 已闭环；真实索引实现留待运行/数据层。

## 解决日期
2026-08-30
