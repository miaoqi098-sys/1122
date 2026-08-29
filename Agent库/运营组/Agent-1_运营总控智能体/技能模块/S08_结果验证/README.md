# S08｜结果验证

## 技能定位
验证S07任务执行后是否真正产生预期经营结果，并区分“动作是否执行成功”“经营结果是否达标”“结果能否归因于本次决策”。

S08不是看一眼指标涨跌，而是建立完整验证链：执行事实 → 数据窗口 → 目标标准 → 保护指标 → 副作用 → 因果归因 → 决策含义。

## 调用位置
```text
S07任务计划
↓
执行层返回actual_execution
↓
观察/数据窗口成熟
↓
S08验证执行事实
↓
验证success criteria / guardrails / stop conditions
↓
检查副作用与经营状态变化
↓
检查concurrent events与归因可信度
↓
输出validation result
↓
Agent-1决定keep / scale / adjust / rollback / rediagnose
↓
满足学习条件后进入S09
```

## 三层结果必须分离
### 1. execution_status
动作本身是否真实执行：
- `not_started`
- `success`
- `partial`
- `failed`
- `unknown`

### 2. business_outcome_status
经营结果是否达到预期：
- `positive`
- `partial_positive`
- `no_effect`
- `negative`
- `not_evaluable`

### 3. overall_validation_status
综合执行、经营结果、保护指标和归因后形成最终验证状态：
- `success`
- `partial_success`
- `no_effect`
- `failed`
- `inconclusive`
- `rollback_triggered`

执行成功不等于经营成功；执行失败时通常不能直接证明策略失败。

## 验证标准 criterion
每个标准应尽量结构化为：
- `criterion_id`
- `criterion_type`
- `metric`
- `baseline`
- `target`
- `actual`
- `comparison`
- `status`
- `window`
- `data_quality`

criterion_type：
- `primary`：核心目标；
- `secondary`：辅助目标；
- `guardrail`：保护指标；
- `stop_condition`：止损/停止条件。

## 观察窗口
`observation_window_status`：
- `not_started`
- `incomplete`
- `complete`
- `invalid`

同时记录：
- `data_completeness`
- `data_freshness`
- `data_quality`

观察窗口未完整时，不因短期波动过早判定策略失败。

## 因果归因
`attribution_status`：
- `strong`
- `moderate`
- `weak`
- `confounded`
- `not_evaluable`

同时记录：
- `confounders`
- `supporting_evidence`
- `contradicting_evidence`

同期促销、价格变化、竞品断货、季节变化、其他任务等必须进入归因判断。

## 失败分类
`failure_type`：
- `execution_failure`
- `strategy_failure`
- `guardrail_breach`
- `data_failure`
- `external_confounding`
- `assumption_failure`
- `premature_evaluation`

失败分类直接影响S09后续能学到什么。

## 决策含义
S08可输出 `decision_implication`：
- `keep`
- `scale`
- `continue_observation`
- `adjust`
- `rollback`
- `rediagnose`

它表示验证结果对原决策意味着什么，不代表S08越权生成新的经营方案。

## 与S07的边界
S07定义任务、成功标准、停止条件、验证节点；S08读取实际执行结果和观测数据进行验收，不事后修改原success_criteria来迎合结果。

## 与S09的边界
S08负责判断“发生了什么、效果如何、归因多可信”；S09负责判断“哪些经验值得沉淀、适用范围是什么”。低归因可信度不得被包装成高置信经营规律。

## 核心原则
Agent-1必须知道：我们计划做什么、实际上做了什么、结果发生了什么，以及结果究竟有多大把握是这次动作造成的。

## 当前版本
V1.1：加入S07完整承接、执行/经营/总体结果分离、结构化criteria、观察窗口与数据质量、结构化归因、失败分类和decision_implication。