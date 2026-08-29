# Agent-1 决策规则

## 1. 模块定位

`决策规则/` 是 Agent-1 最终经营决策的治理规则层，用于约束“什么可以进入比较、如何排序、何时保持策略、何时允许改变、何时需要审批或更多证据、最终决策必须满足什么条件”。

本模块不负责生成业务事实，不代替专业 Agent，不直接执行动作，也不重新实现 S04/S06/S10/DecisionSelector。它负责把这些能力之间必须共同遵守的决策约束固化为可审计规则。

## 2. 与核心模块的边界

- `目标系统/`：定义经营目标、目标层级与动态权重；本模块消费目标规则，不另建第二套目标优先级。
- `技能模块/S04_决策排序/`：对 DecisionItem 做动态业务排序；本模块规定排序必须受哪些硬约束、目标和证据规则约束。
- `技能模块/S05_方案生成/`：生成 Option；本模块不替代方案生成。
- `技能模块/S06_风险评估/`：生成 RiskAssessment 与 eligibility；本模块规定哪些 eligibility 可以进入最终选择以及附带什么控制条件。
- `技能模块/S10_策略防抖/`：判断运行中策略是否允许改变；本模块规定 FinalDecision 在策略变更场景必须遵守的稳定性门禁。
- `技能模块/统一接口/DecisionSelector.*`：形成最终方案选择；本模块定义选择资格、证据、审批、降级和追溯规则。
- `决策模板库/`：提供重复经营场景的标准模板；模板不得覆盖本模块规则。
- `任务调度/` 与 S07：在 FinalDecision 之后编排 Task；本模块不决定执行步骤。

## 3. 正式决策链

```text
Event / ContextPackage
↓
DecisionItemBuilder
↓
S04 动态业务优先级
↓
S05 Option[]
↓
S06 RiskAssessment[] / eligibility
↓
必要时 S10 StrategyStabilization
↓
DecisionSelector
↓
FinalDecision
↓
S07 TaskOrchestration
```

## 4. 规则优先关系

决策规则采用“资格门 → 动态排序 → 方案比较 → 稳定性门禁 → 最终决策”的顺序，而不是一条永久固定的经营指标排行榜。

1. **资格门**：合规、可售、禁止动作、关键审批、重大不可逆风险等硬约束先判断。
2. **动态排序**：通过资格门的经营事项由目标层级、经营状态、风险窗口、机会窗口、证据、依赖和资源动态排序。
3. **方案比较**：只比较具备资格的 Option；控制条件必须随被选方案进入 FinalDecision。
4. **稳定性门禁**：若会改变正在运行的 StrategyChain，先检查 S10 是否允许改变。
5. **最终决策**：DecisionSelector 只能在规则允许的候选集内选择，并保留 why_selected、why_not_others、evidence_refs 和历史/冲突引用。

## 5. 文件结构

- `决策总则.md`：全模块总原则和决策顺序。
- `资格与硬约束.md`：S06 eligibility、硬阻断、控制条件和审批规则。
- `动态优先级规则.md`：目标系统与 S04 的统一排序约束。
- `策略稳定与反转规则.md`：S10/StrategyChain 的变更门禁。
- `最终决策边界.md`：DecisionSelector 与 FinalDecision 的资格和职责边界。
- `信息不足审批与降级.md`：证据不足、冲突、审批和无法形成安全决策时的处理路径。
- `示例与验收.md`：典型冲突场景与静态验收。

## 6. 核心原则

- Agent-1 是唯一最终经营决策出口，但不能越过硬约束和风险资格门。
- 高层级目标优先确保安全区，不代表永久无限最大化。
- 同层目标不使用永久固定顺序；优先级必须能解释为何变化。
- `prohibited` Option 永远不能被 FinalDecision 选中。
- `requires_more_evidence` 不能被伪装成确定决策。
- 改变正在运行的策略必须有新证据、状态变化、guardrail/stop trigger 或其他可追溯理由。
- 短期改善不得无边界牺牲长期价格、库存、账户、现金流或经营资产。
- 每个 FinalDecision 必须有证据、替代方案比较、风险控制、观察/复核条件和必要的回滚引用。

## 7. 当前阶段

当前为框架规则层。真实 DecisionSelector 执行、Schema Validator、Runner、Scheduler、Executor 等仍属于系统运行/共享基础设施，不在本模块实现。