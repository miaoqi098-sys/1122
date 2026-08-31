# Agent-2｜事件类型与输出

## 1. 输出合同
Agent-2主动上报的事件必须符合Agent-1：
`输入规范/智能事件包.schema.json`

本目录只定义Agent-2特有的event_type、映射和证据要求，不复制第二份Event Schema。

## 2. 事件类型目录
建议稳定event_type：
- `product_availability_changed`
- `detail_page_unavailable`
- `listing_suppressed`
- `featured_offer_lost`
- `featured_offer_restored`
- `reference_price_visibility_changed`
- `promotion_display_changed`
- `listing_content_missing_or_mismatch`
- `variation_relation_changed`
- `rating_display_changed`
- `qualification_status_changed`
- `frontend_backend_status_conflict`
- `product_state_restored`
- `product_state_unknown_requires_recheck`

新增event_type必须有清楚的触发定义，不能为同义变化不断新造名称。

## 3. Event映射
至少填：
- event_id
- source_type = professional_agent
- source_agent = Agent-2
- source_ref
- event_type
- scope_type / scope_id / scope_objects
- severity
- occurred_at / received_at（如适用）
- summary
- facts[]
- metrics（如有）
- confidence
- evidence_refs[]
- data_window
- related_events / parent_event_id（如适用）
- recommendation（可选）

## 4. Facts规则
facts必须写可证实状态，例如：
- “2026-08-30 03:00+08 前台页面返回not found”；
- “Seller后台SKU状态由active变为suppressed”；
- “连续两次前台检查未显示Featured Offer”。

不得把以下内容写进facts：
- “应该降价”；
- “竞争对手恶意操作”；
- “一定是平台bug”；
- “这会导致销量下降30%”。

后者属于解释、假设或建议。

## 5. Recommendation
Agent-2可以提供可选recommendation，例如“建议Agent-1请求Agent-12核验资质状态”。

recommendation不是硬必填，也不是已批准动作。

## 6. Severity边界
severity只描述事件紧急/影响建议，不替代Agent-1 S04 business_priority。

## 7. 恢复与持续事件
异常持续时更新证据/持续时间，不重复创建等价事件。恢复时可生成restored事件并通过related_events关联原异常。

## 8. 信息不足
证据不足时可以生成低严重度`product_state_unknown_requires_recheck`，或暂不形成Event而保留内部复核任务；不得把unknown写成确定异常。