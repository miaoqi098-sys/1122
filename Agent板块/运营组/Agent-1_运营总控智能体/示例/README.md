# Agent-1 示例

## 1. 模块定位
`示例/` 用于把 Agent-1 当前 canonical 规则、对象与异常路由落成可检查的端到端样例，帮助后续人工审阅、Schema校验、Runner实现和回归测试。

示例不是新的规则真源。若示例与正式Schema/规则冲突，以正式Schema/规则为准，并修订示例。

## 2. 示例覆盖范围
- 标准智能事件包；
- Event→ContextPackage→DecisionItem→Option→RiskAssessment→FinalDecision 的完整决策链；
- FinalDecision→TaskPlan/Task→ExecutionResult→ValidationResult→LearningRecord 的执行验证学习链；
- 多Agent冲突、审批、S10策略防抖、blocked/needs_information 等综合场景。

## 3. Canonical对象链
`Event → ContextPackage → DecisionItem → Option → RiskAssessment → FinalDecision → TaskPlan/Task → ExecutionResult → ValidationResult → LearningRecord`

示例中的对象ID必须保持引用闭合。

## 4. Scope
示例统一支持：
`account / store / global / parent_product / product / sku / campaign / ad_group / keyword / task / decision / other`

不得默认所有示例都强制product_id/ASIN。

## 5. 来源与建议
- source/source_type/source refs必须可追溯；
- recommendation若出现，只代表来源Agent的建议，是可选输入，不是Event硬必填，也不代表Agent-1最终决策。

## 6. 状态边界
示例必须保持：
- Task created ≠ executed；
- approval ≠ execution success；
- ExecutionResult success ≠ ValidationResult success；
- S09 memory_writes plan ≠ memory written；
- S10 hold ≠ failure。

## 7. 文件
- `智能事件包.example.json`
- `完整决策链.example.md`
- `任务验证学习链.example.md`
- `多Agent综合场景.example.md`
- `总验收记录.md`

## 8. 动态运行边界
示例可以描述未来运行结果，但不能把未真实执行的Runner/API/Scheduler/Executor测试冒充动态验收通过。