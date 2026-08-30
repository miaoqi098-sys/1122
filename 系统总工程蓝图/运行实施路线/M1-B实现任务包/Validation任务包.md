# Validation 实现任务包 V1

> 覆盖：R-GP-018

## 1. 目标
独立回答“动作执行后，经营结果是否达到预期”，不得由Executor自行宣布成功。

## 2. 输入
- task_id / action_id / execution_result_id
- Goal / success_criteria
- Event / resolution criteria
- observation_window
- before MetricSnapshot refs
- after MetricSnapshot refs
- validation rule/version

## 3. 输出
ValidationResult至少表达：
- validated_at
- status: success / no_effect / negative_effect / inconclusive / insufficient_data / pending
- evidence_refs
- metric_deltas
- observation_window
- rule_version
- confidence / limitations

## 4. 时间边界
执行完成后如果观察窗口未到，必须返回 pending，不能提前判定成功。

## 5. Event/Goal联动
- Validation成功可作为 Event resolved 的证据，但 Event Repository仍执行独立状态迁移。
- Goal达成由Goal Evaluator结合Validation/Metric判断。
- Validation失败可能产生新Event/Task候选，但不能自动无限重试原Action。

## 6. 验收条件
- ExecutionResult success不自动等于Validation success；
- before/after指标使用同口径和可比窗口；
- 数据不足明确输出inconclusive/insufficient_data；
- 验证规则版本可追溯；
- 结果能回写Activity/Memory/UI但不覆盖源事实。

## 7. 静态L1
独立验证输入输出、观察窗口和Goal/Event联动边界已明确。L1：PASS。