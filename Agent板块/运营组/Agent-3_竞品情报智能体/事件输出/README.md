# Agent-3｜事件类型与输出

## 1. 输出合同
Agent-3主动输出必须符合：
`Agent-1_运营总控智能体/输入规范/智能事件包.schema.json`

固定：
- source_type=`professional_agent`
- source_agent=`Agent-3`

## 2. 建议event_type目录
- `competitor_price_shift`
- `competitor_promotion_shift`
- `competitor_visibility_shift`
- `competitor_listing_change`
- `competitor_rating_display_shift`
- `competitor_new_entry`
- `competitor_relation_change`
- `competitor_coordinated_move`
- `competitive_pressure_signal`
- `competitive_opportunity_signal`
- `competitor_signal_recovered`

## 3. 事件必须携带
- 我方scope；
- competitor_entity_id / entity_ref；
- relationship_type；
- marketplace；
- 当前与基线快照引用；
- facts；
- occurred_at/data_window；
- evidence_refs；
- confidence；
- missing_data（可放metadata）；
- 是否仍需其他Agent协同。

## 4. severity
Agent-3可以给出P0-P3事件严重度建议，但它表示“该竞争信号值得多快被处理”，不代表Agent-1最终业务优先级。

## 5. recommendation
recommendation可选，只能表达专业建议，例如“建议Agent-10评估价格响应空间”或“建议Agent-8确认是否为类目趋势”。不得写成已批准动作。

## 6. 事件去重与关联
同一持续信号优先更新原事件相关证据，通过related_events/parent_event_id保留变化链。恢复事件必须引用原异常/信号事件。

## 7. 不应生成业务事件的情况
- 只有工具错误；
- 快照不可比；
- 单一低置信观察且没有业务影响证据；
- 竞品关系尚未确认，且只是偶然搜索曝光；
- 推断完全依赖未经标注的估算数据。