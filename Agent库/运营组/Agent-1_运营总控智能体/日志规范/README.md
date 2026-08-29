# Agent-1 日志规范

## 1. 模块定位
`日志规范/` 定义 Agent-1 各业务对象在生命周期中的可追溯记录要求，保证 Event→Decision→Task→Execution→Validation→Learning 全链可审计。

日志不是历史记忆本体，也不是运行监控实现：
- `日志规范/` 定义“发生了什么需要记录、如何引用、如何追加版本”；
- `历史记忆/` 定义哪些业务事实/决策/结果需要长期复用；
- `运行层` 负责真实日志采集、存储、检索、trace和监控。

## 2. 业务日志层级
- 事件日志：Event、来源、证据、生命周期、去重/合并/关联。
- 决策日志：DecisionItem、Option、RiskAssessment、FinalDecision、策略链与选择依据。
- 任务与执行日志：TaskPlan、Task、审批、调度状态、ExecutionResult。
- 验证与学习日志：ValidationResult、LearningRecord、memory_writes plan。
- 版本与追溯：业务主键、版本、source/evidence refs、strategy_chain_id与运行trace边界。

## 3. Append-only原则
日志默认追加，不静默覆盖旧状态。对象修订应保存：
- object_id；
- version/revision；
- previous_version/ref；
- changed_at；
- changed_by/source；
- change_reason。

## 4. Canonical追溯主链
`event_id → decision_item_id → option_id → decision_id → task_plan_id → task_id → execution_result_id → validation_id → learning_id`

`strategy_chain_id`横跨策略生命周期。

`run_id / trace_id / parent_run_id`只做运行追踪，不替代业务主键。

## 5. Scope
日志不得强制所有对象都有product_id/ASIN。统一支持：
`account / store / global / parent_product / product / sku / campaign / ad_group / keyword / task / decision / other`。

## 6. 证据原则
关键判断必须可回到source/evidence refs。日志中必须区分：
- fact；
- interpretation；
- recommendation/decision；
- execution fact；
- validation conclusion；
- learning candidate。

## 7. 禁止
- 把ExecutionResult或ValidationResult写进FinalDecision本体当“最终结果”；
- 把run_id当decision_id/task_id；
- 用日志覆盖历史对象；
- 没有真实执行回执却写executed/succeeded；
- S09没有真实写入回执却写memory written；
- 只记录摘要而丢失源证据引用。

## 8. 文件
- `事件日志规范.md`
- `决策日志规范.md`
- `任务与执行日志规范.md`
- `验证与学习日志规范.md`
- `追溯版本与证据.md`
- `示例与验收.md`
- `总验收记录.md`

## 9. 运行边界
真实日志存储、索引、结构化采集、trace系统、告警和保留周期属于系统运行/记忆数据层，本模块只定义框架合同。