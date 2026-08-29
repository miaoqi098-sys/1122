# Agent-3｜历史、证据与置信度

## 1. 历史对象
至少保留：
- 竞品关系版本；
- 竞品快照；
- 变化信号；
- 事件历史与恢复；
- 请求响应结果引用；
- 证据来源和数据窗口。

## 2. 不覆盖历史
最新竞品关系或快照不得覆盖旧版本。关系被降级/移除时保留有效期；信号恢复时保留原信号和恢复关系。

## 3. 证据分层
建议至少区分：
- direct_observation：直接可观察事实；
- official_source：官方/后台来源；
- third_party_measured：第三方测量数据；
- third_party_estimate：第三方估算；
- human_input：人工输入；
- inference：Agent解释/推断。

事实和inference不能混成同一层。

## 4. confidence
confidence反映当前结论的证据充分程度，不等于业务价值。主要受：来源可靠性、来源一致性、可比性、时间新鲜度、重复观察、实体映射确定性影响。

## 5. 去重
同一竞争信号使用稳定指纹持续更新，避免重复事件。竞品关系本身也应按 `competitor_entity_id + our_scope + marketplace` 去重。

## 6. 证据冲突
来源冲突时保留双方，不静默选择“更顺眼”的值。必要时降低confidence、设置comparison_eligible=false，或输出answered_with_gaps/insufficient_evidence。

## 7. 运行边界
历史真实持久化依赖R06；本模块只定义对象、版本、引用和证据语义。