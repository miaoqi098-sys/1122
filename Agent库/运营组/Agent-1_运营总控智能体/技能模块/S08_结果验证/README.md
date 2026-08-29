# S08｜结果验证

## 技能定位
S08验证S07任务执行后是否真正产生预期经营结果，并严格区分：动作是否执行成功、业务结果是否达标、结果能否归因于本次决策。

## 正式调用位置
```text
S07 Task
↓
执行层
↓
ExecutionResult
+
baseline / observed_results / observation_window
↓
S08 OutcomeValidation
↓
ValidationResult
↓
Agent-1 keep / scale / continue_observation / adjust / rollback / rediagnose
↓
S09
```

## 正式执行输入
执行层必须先把API、工具或人工执行结果标准化为Canonical `ExecutionResult`。

S08正式输入使用`execution_result`，不再使用`actual_execution`旧别名。

ExecutionResult至少应可追溯：
- execution_result_id
- task_id
- task_plan_id
- decision_id
- decision_item_id
- option_id（如有）
- strategy_chain_id（如有）
- requested_action
- actual_action
- execution_status
- executor

## 三层结果
### execution_status
- not_started
- success
- partial
- failed
- unknown

### business_outcome_status
- positive
- partial_positive
- no_effect
- negative
- not_evaluable

### overall_validation_status
- success
- partial_success
- no_effect
- failed
- inconclusive
- rollback_triggered

执行成功不等于业务成功；执行失败通常也不能直接证明策略失败。

## ValidationResult正式主键
S08必须生成唯一`validation_id`。

ValidationResult至少保留：
- validation_id
- execution_result_id
- task_id
- task_plan_id
- decision_id
- decision_item_id
- option_id / strategy_chain_id（如有）
- criteria_results
- observation_window_status
- data_quality
- attribution_status
- failure_type
- confidence
- decision_implication

## criterion
criterion_type：
- primary
- secondary
- guardrail
- stop_condition

不得在看到结果后修改原success criteria迎合结果。

## 观察窗口与数据质量
观察窗口：
- not_started
- incomplete
- complete
- invalid

数据质量应记录完整性、新鲜度和总体质量。

观察窗口未成熟时，不因短期波动过早判定策略失败。

## 因果归因
attribution_status：
- strong
- moderate
- weak
- confounded
- not_evaluable

同期促销、价格变化、竞品变化、季节因素和其他并行动作都必须进入confounders判断。

## failure_type
- execution_failure
- strategy_failure
- guardrail_breach
- data_failure
- external_confounding
- assumption_failure
- premature_evaluation

该字段直接约束S09后续能学到什么。

## 与S07边界
S07定义Task和验证条件；S08验证真实执行与经营结果，不负责重新编排任务。

## 与S09边界
S08回答“发生了什么、效果怎样、归因多可信”；S09回答“哪些内容值得成为事实、经验或知识候选”。

## 当前版本
- 业务规则：V1.1；
- 接口：V1.2，已统一ExecutionResult输入并正式生成ValidationResult/validation_id；
- 执行程序：待系统运行层实现ExecutionVerifier、CriteriaEvaluator、AttributionEvaluator和ValidationPackager。