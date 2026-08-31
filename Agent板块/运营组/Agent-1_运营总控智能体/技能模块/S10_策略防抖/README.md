# S10｜策略防抖

## 技能定位
S10贯穿计划、执行、观察和验证阶段，识别噪声、重复事件、正常微调、趋势、状态切换和重大风险，防止Agent-1在证据不足时频繁反向调整策略，同时允许关键新事实及时打断旧策略。

S10不是主链固定第10步，而是横向策略稳定器。

## 正式调用位置
```text
新Event / 新Option / 新Decision proposal
↓
判断是否可能影响现有StrategyChain
↓
必要时S03确认strategy conflict
↓
S10 StrategyStabilization
↓
allow / hold / merge / escalate / override
```

- allow：进入正常DecisionSelector/S07链；
- hold：保持当前策略，不创建反向Task；
- merge：并入现有StrategyChain；
- escalate：进入审批/复核；
- override：保留旧Decision/Task历史，并交S07重新编排。

## 正式作用域
S10使用统一`scope`，支持product/account/store/campaign/keyword/task/decision等作用域，不再要求顶层product_id作为唯一对象模型。

## StrategyChain
正式StrategyChain使用：
- strategy_chain_id
- scope
- target
- decision_item_id
- decision_ids[]
- option_ids[]
- task_ids[]
- validation_ids[]
- original_direction
- current_direction
- observation_window
- adjustment_count
- reversal_count
- current_status

一条策略链可以跨多个Decision版本，因此不再只保存单一`decision_id`。

## Action Relation
- same_direction
- minor_adjustment
- neutral
- partial_reversal
- full_reversal
- conflicting_action

## Evidence Delta
- weaker
- same
- stronger
- critical_new_fact
- unknown

## Signal Classification
- noise
- repeated_signal
- trend
- state_change
- guardrail_trigger
- stop_trigger
- critical_risk

## Hold Gate
hold必须说明：
- hold_reason
- hold_until
- release_conditions
- review_trigger
- required_new_evidence

hold不是固定天数死等。stop condition、guardrail、state change或critical risk可提前释放。

## Override Gate
允许override的典型情况：
- stop_condition触发；
- guardrail达到不可接受水平；
- critical risk；
- 状态确认切换导致旧策略失效；
- critical_new_fact；
- 新证据显著强于启动旧策略的证据。

## Override Record
每次override至少保留：
- overridden_decision_id
- overridden_task_ids
- strategy_chain_id
- trigger
- evidence_refs
- previous_direction
- new_direction
- reason
- approval_required
- old_task_actions

旧任务处置由S07重新编排，S10不直接执行cancel/pause/rollback。

## 正式输出追溯
S10输出必须生成唯一`stabilization_id`，并尽量保留：
- strategy_chain_id
- source_decision_id
- source_decision_item_id
- matched_tasks

## 模块边界
- S03：发现冲突；
- S10：判断现在是否足以改变运行中的策略；
- DecisionSelector：形成新的FinalDecision；
- S07：重新编排任务；
- S08：验证实际经营结果。

## 核心原则
成熟系统既不能一天一个策略，也不能死守已被事实推翻的旧策略。S10负责把“噪声”和“真正必须改变的事实”分开。

## 当前版本
- 业务规则：V1.1；
- 接口：V1.2，已统一scope、StrategyChain决策历史和stabilization_id；
- 执行程序：待系统运行层实现StrategyComparator、EvidenceDeltaEvaluator、SignalClassifier和StabilizationResolver。