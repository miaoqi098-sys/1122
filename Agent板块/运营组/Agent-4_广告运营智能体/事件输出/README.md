# Agent-4｜事件类型与输出

## 1. 定位
Agent-4把已达到证据门槛的广告异常、机会、风险和需要跨Agent判断的问题，先形成广告领域事件；交给Agent-1统一决策前，必须遵循 `Agent库/运营组/公共协议/专业Agent事件协议.md`，规范化为 Agent-1 `输入规范/智能事件包.schema.json`。事件不是FinalDecision，也不直接下发执行任务。

`AdvertisingIntelligenceEvent.schema.json` 是 **Agent-4领域事件Schema**，不是 Agent-1 的第二份标准 Event Schema。

## 2. 事件类别
### 异常类
- traffic_drop / traffic_spike
- ctr_deterioration
- cpc_increase
- conversion_drop
- high_click_no_order
- spend_without_sales
- acos_deterioration / roas_deterioration
- budget_exhaustion
- pacing_imbalance
- structure_overlap
- low_relevance_search_term

### 机会类
- scalable_high_efficiency_target
- search_term_harvest_opportunity
- budget_reallocation_opportunity
- placement_opportunity
- structure_isolation_opportunity
- exploration_expansion_opportunity

### 升级类
- profit_constraint_needed
- inventory_constraint_needed
- listing_conversion_check_needed
- promotion_price_context_needed
- multi_agent_conflict

## 3. 触发门槛
触发领域事件必须同时满足：
- 有明确scope与受影响广告实体；
- current_window与baseline_window可解释；
- evidence_refs可追溯；
- 数据质量达到最低要求；
- 已排除明显归因延迟/缺失数据误报；
- severity与confidence被单独评估。

证据不足时输出observation/needs_more_evidence，不得升级为confirmed高置信事件。

## 4. 领域事件字段
见 `AdvertisingIntelligenceEvent.schema.json`。核心包括：event_id、source_agent、event_type、scope、affected_entities、severity、confidence、status、current_window、baseline_window、evidence_refs、metric_deltas、diagnosis、recommendation_candidates、cross_agent_requests、generated_at。

## 5. 交给Agent-1前的规范化
必须按公共协议映射：
- `scope` → Agent-1 `scope_type/scope_id/scope_objects`；
- `severity: critical/high/medium/low/info` → `P0/P1/P2/P3`；
- `confidence: low/medium/high` → 0–1数值，并保留原标签；
- `generated_at/观测时间` → `occurred_at`；
- 可证实观测 → `facts[]`；
- recommendation_candidates只作为可选recommendation/metadata，不成为FinalDecision；
- 原领域对象/状态/窗口保留于handoff或metadata，保证可追溯。

参考：`Agent库/运营组/公共协议/示例/Agent4广告事件交接.example.json`。

## 6. recommendation_candidates
只允许表达候选动作，例如reduce_bid、increase_bid_candidate、harvest_to_exact、add_negative_candidate、reallocate_budget_candidate、split_structure_candidate、observe。必须包含理由、风险、观察窗口；不能写成已批准动作。

## 7. 去重与更新
相同scope + event_type + affected_entities + active strategy context的领域事件应优先更新原event，而不是持续创建新event。状态建议：observed → confirmed → recovering → resolved；若证据反转可closed_as_false_positive。规范化后的Canonical Event同样必须遵守Agent-1事件去重/关联规则。

## 8. 升级到Agent-1
以下必须交Agent-1：利润/库存/促销等跨域约束；多个广告动作互相冲突；涉及大幅预算迁移；需要策略反转；需要人工审批；高severity且可能影响产品经营目标。

## 9. 禁止
- 不以“ACOS高”单点事实生成确定性原因；
- 不把专业建议标记为FinalDecision；
- 不绕过Agent-1直接创建执行任务；
- 不丢失source_ref、窗口和受影响实体；
- 不把 `AdvertisingIntelligenceEvent` 未规范化直接送入Agent-1 S01；
- 不把run_id/trace_id塞入业务事件主字段。