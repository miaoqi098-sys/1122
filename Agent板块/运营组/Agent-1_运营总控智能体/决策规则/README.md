# Agent-1 决策规则

## 1. 模块定位

`决策规则/` 是 Agent-1 最终经营决策的治理规则层，用于约束“什么可以进入比较、如何排序、何时保持策略、何时允许改变、多个事项如何并发裁决、目标之间允许牺牲到什么程度、证据最低要求是什么、决策何时失效，以及最终决策必须满足什么条件”。

本模块不负责生成业务事实，不代替专业 Agent，不直接执行动作，也不重新实现 S04/S06/S10/DecisionSelector。它负责把这些能力之间必须共同遵守的决策约束固化为可审计规则。

## 2. 与核心模块的边界

- `目标系统/`：定义经营目标、目标层级与动态权重；本模块消费目标规则，不另建第二套目标优先级。
- `技能模块/S04_决策排序/`：对 DecisionItem 做动态业务排序；本模块规定排序必须受哪些硬约束、目标、影响范围、机会窗口和证据规则约束。
- `技能模块/S05_方案生成/`：生成 Option；本模块不替代方案生成。
- `技能模块/S06_风险评估/`：生成 RiskAssessment 与 eligibility；本模块规定哪些 eligibility 可以进入最终选择以及附带什么控制条件。
- `技能模块/S10_策略防抖/`：判断运行中策略是否允许改变；本模块规定 maintain/tune/scale/replace/reverse 等策略变化必须遵守的稳定性门禁。
- `技能模块/统一接口/DecisionSelector.*`：形成最终方案选择；本模块定义选择资格、证据、审批、降级、并发、生命周期和追溯规则。
- `决策模板库/`：提供重复经营场景的标准模板和具体 Minimum Evidence Set；模板不得覆盖或降低本模块治理规则。
- `任务调度/` 与 S07：在 FinalDecision 之后编排 Task；本模块不决定执行步骤。

## 3. 正式决策链

```text
Event / ContextPackage
↓
DecisionItemBuilder
↓
资格与硬约束 / Minimum Evidence Gate
↓
S04 动态业务优先级
↓
必要时 多决策并发裁决 / 目标冲突与牺牲边界
↓
S05 Option[]
↓
S06 RiskAssessment[] / eligibility
↓
必要时 S10 StrategyStabilization
↓
DecisionSelector
↓
FinalDecision + 生命周期状态
↓
S07 TaskOrchestration
```

## 4. 规则优先关系

决策规则采用“资格门 → 证据门 → 动态排序 → 并发/目标交换 → 方案比较 → 稳定性门禁 → 最终决策 → 生命周期”的顺序，而不是一条永久固定的经营指标排行榜。

1. **资格门**：合规、可售、禁止动作、关键审批、重大不可逆风险等硬约束先判断。
2. **证据门**：检查当前 decision_type 是否达到 Minimum Evidence Set；关键证据不足时不得包装成确定决策。
3. **动态排序**：通过资格门的经营事项由目标层级、经营状态、风险窗口、机会窗口、影响范围、证据、依赖和资源动态排序。
4. **并发/目标交换**：多个 P0/P1、资源争用或目标互相牺牲时，必须显式裁决并行/串行/合并与 trade-off boundary。
5. **方案比较**：只比较具备资格的 Option；控制条件必须随被选方案进入 FinalDecision。
6. **稳定性门禁**：若会改变正在运行的 StrategyChain，先检查 S10 是否允许 maintain/tune/scale/replace/reverse。
7. **最终决策**：DecisionSelector 只能在规则允许的候选集内选择，并保留 why_selected、why_not_others、evidence_refs 和历史/冲突引用。
8. **生命周期**：FinalDecision 必须进入明确状态，不得被原地覆盖。

## 5. 文件结构

- `决策总则.md`：全模块总原则和决策顺序。
- `资格与硬约束.md`：S06 eligibility、硬阻断分级、控制条件和审批规则。
- `最小证据集规则.md`：不同决策类型进入正常 FinalDecision 前的最低证据治理。
- `动态优先级规则.md`：目标系统、影响范围、延迟成本、机会窗口与 S04 的统一排序约束。
- `多决策并发裁决规则.md`：多个 DecisionItem / 多 P0 / 多 Agent / 共享资源冲突的裁决。
- `目标冲突与牺牲边界.md`：多目标 trade-off、最大允许牺牲、窗口和恢复边界。
- `策略稳定与反转规则.md`：S10/StrategyChain 的 maintain/tune/scale/replace/reverse 门禁。
- `最终决策边界.md`：DecisionSelector 与 FinalDecision 的资格、职责和生命周期边界。
- `决策生命周期规则.md`：FinalDecision 的状态机、失效、替代、过期和部分执行处理。
- `信息不足审批与降级.md`：证据不足、冲突、审批和无法形成安全决策时的处理路径。
- `规则调用矩阵.md`：不同场景必须加载哪些治理规则。
- `示例与验收.md`：典型冲突场景与静态验收。
- `总验收记录.md`：历史自动施工验收记录，仅作历史参考，不代表当前人工排查封板。

## 6. 核心原则

- Agent-1 是唯一最终经营决策出口，但不能越过硬约束和风险资格门。
- 高层级目标优先确保安全区，不代表永久无限最大化。
- 同层目标不使用永久固定顺序；优先级必须能解释为何变化。
- `prohibited` Option 永远不能被 FinalDecision 选中。
- `requires_more_evidence` 不能被伪装成确定决策。
- 多个 P0 不等于全部同时执行，必须考虑依赖、资源和冲突。
- 目标交换必须有限度，不能使用“战略需要”作为无限牺牲理由。
- 改变正在运行的策略必须有新证据、状态变化、guardrail/stop trigger 或其他可追溯理由。
- 短期改善不得无边界牺牲长期价格、库存、账户、现金流或经营资产。
- 每个 FinalDecision 必须有证据、替代方案比较、风险控制、观察/复核条件和必要的回滚引用。
- active / partially_executed Decision 不得原地覆盖；变化必须通过生命周期与 supersedes 关系追溯。

## 7. 当前阶段

当前为**人工逐项排查与完善阶段，不封板**。本模块已经补入并发裁决、目标牺牲边界、决策生命周期、最小证据集、硬约束分级、策略微调类型和规则调用矩阵，但仍需继续与目标系统、决策模板库、S04/S06/S10、FinalDecision Schema 进行后续人工一致性排查。

真实 DecisionSelector 执行、Schema Validator、Runner、Scheduler、Executor 等仍属于系统运行/共享基础设施，不在本模块实现。
