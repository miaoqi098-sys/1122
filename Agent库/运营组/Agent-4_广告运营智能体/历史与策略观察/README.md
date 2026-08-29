# Agent-4｜历史证据与策略观察

## 1. 目的
广告诊断必须能区分“自然波动、数据延迟、一次性异常、策略变更后的预期变化、真正结构性恶化”。因此Agent-4需要保存广告事实快照、策略变更引用与观察窗口。

## 2. 需要追溯的历史
- 广告实体状态与层级关系；
- bid、budget、placement变更；
- keyword/target/negative新增、暂停、迁移；
- campaign/ad_group结构调整；
- 关键指标窗口；
- 产生过的广告智能事件及状态更新；
- Agent-1最终决策引用；
- Task/ExecutionResult/ValidationResult引用。

## 3. 变更记录最小字段
change_id、entity_type、entity_id、change_type、old_value、new_value、changed_at、decision_id、task_id、strategy_chain_id、expected_effect、minimum_observation_window、rollback_condition、evidence_refs。

## 4. 观察窗口
任何策略变更后，应定义：
- pre_change_window；
- change_at；
- minimum_observation_window；
- post_change_window；
- validation_metrics；
- confounders。

未达到最低观察窗口时，除重大风险外不得把短期波动直接解释成策略失败。

## 5. 防止历史污染
历史数据若跨越价格、促销、库存、Listing重大变化，必须标记confounder，不得直接当作稳定基线。归因口径变化、广告报表定义变化也必须切断可比性或做显式转换。

## 6. 事件更新而非重复创建
同一诊断对象和同一问题在活动期内优先更新event status和证据，不持续创建等价事件。resolved后若新窗口重新出现，可创建reopened/new occurrence并引用旧event。

## 7. 策略反转
当建议与近期策略方向相反时，必须标记strategy_reversal_candidate，并提供：原策略目标、已运行窗口、实际结果、反转原因、新证据。交Agent-1/S10策略防抖机制判断。

## 8. 记忆边界
Agent-4定义需要保存什么和如何引用；真实长期持久化由记忆与数据层/运行依赖负责。不得因为当前没有数据库就伪造“已持久化”。