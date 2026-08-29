# S10｜策略防抖

## 技能定位
贯穿计划、执行、观察和验证阶段，识别短期噪声、重复事件、正常微调、真正趋势、经营状态切换与重大风险，防止Agent-1在证据不足时频繁反向调整策略，同时允许在关键新事实出现时及时打断旧策略。

S10不是“禁止改变”，而是判断：现在这个新动作，是正常迭代，还是没有足够新理由的策略摇摆。

## 调用位置
```text
新事件 / 新建议 / 新任务候选
↓
S03：是否与当前结论/策略冲突
↓
S10：是否构成反转或抖动
↓
Action Relation
↓
Strategy Chain
↓
Evidence Delta
↓
Signal Classification
↓
Hold Gate / Override Gate
↓
allow / hold / merge / escalate / override
↓
如允许改变 → S07重新编排任务
如hold → 保持原策略并等待release condition
如override → 处理旧任务并建立新任务链
```

## 防抖对象
广告竞价/预算、价格与促销、Listing内容、库存放量策略、关键词测试、实验任务及其他需要观察窗口的动作。

## Action Relation
新动作与当前策略关系：
- `same_direction`：同方向继续推进；
- `minor_adjustment`：同策略内小幅微调；
- `neutral`：不改变当前方向；
- `partial_reversal`：部分反转；
- `full_reversal`：完全反转；
- `conflicting_action`：动作类型或目标冲突，需进一步判断。

比较维度至少包括：target、action_type、direction、magnitude、scope、time_horizon。

## Strategy Chain
S10不只看单个Task，而应追踪完整策略链：
- `strategy_chain_id`
- `decision_id`
- `option_id`
- `target`
- `original_direction`
- `current_direction`
- `started_at`
- `observation_window`
- `adjustment_count`
- `reversal_count`
- `last_change_at`
- `current_status`

连续多次小改即使没有单次full reversal，也可能构成慢性抖动。

## Evidence Delta
比较启动原策略时的证据与当前新证据：
- `weaker`
- `same`
- `stronger`
- `critical_new_fact`

同时考虑original_evidence_strength、new_evidence_strength、original_confidence、new_confidence、state_change、risk_trigger、stop_condition_trigger。

## Signal Classification
- `noise`：单点/低质量短期波动；
- `repeated_signal`：同一事实重复上报；
- `trend`：连续同方向证据形成趋势；
- `state_change`：经营状态确认切换；
- `guardrail_trigger`：保护指标触发；
- `stop_trigger`：明确停止条件触发；
- `critical_risk`：合规、不可售、重大库存/资金等高层风险。

不同signal_class不能用同一种防抖处理。

## Hold Gate
hold必须说明：
- `hold_reason`
- `hold_until`
- `release_conditions`
- `review_trigger`
- `required_new_evidence`

hold不是机械等待固定天数。正常等待观察窗口，但stop condition、状态切换或critical risk可以提前释放。

## Override Gate
override通常需要至少一种情况：
- stop_condition明确触发；
- guardrail达到不可接受风险；
- critical risk出现；
- 经营状态确认切换并使旧策略失效；
- 出现critical_new_fact；
- 新证据显著强于启动旧策略时的证据。

## Override Record
每次override应记录：
- `overridden_decision_id`
- `overridden_task_ids`
- `strategy_chain_id`
- `trigger`
- `evidence_refs`
- `previous_direction`
- `new_direction`
- `reason`
- `approval_required`
- `old_task_actions`

old_task_actions用于告诉S07：旧任务是cancel、pause、rollback还是继续monitor。

## 输出状态
- `allow`：允许进入正常新决策/任务编排；
- `hold`：继续现有策略观察窗口；
- `merge`：重复事件或同策略更新并入当前策略链；
- `escalate`：证据/风险冲突，需要更高审批或专业复核；
- `override`：关键新事实或保护条件足以提前覆盖旧策略。

## 模块边界
- S03：判断结论/策略之间是否冲突；
- S10：判断现在是否有足够理由改变已经运行的策略；
- S07：变化被允许后，负责取消/暂停/回滚旧任务并重新编排新任务；
- S08：最终验证旧/新策略经营效果。

## 核心原则
成熟系统既不能一天一个策略，也不能死守已经被事实推翻的旧策略。S10负责区分噪声、微调、趋势、状态切换和真正必须立刻响应的风险。

## 当前版本
V1.1：加入Action Relation、Strategy Chain、Evidence Delta、Signal Classification、Hold Gate、Override Gate和Override Record。