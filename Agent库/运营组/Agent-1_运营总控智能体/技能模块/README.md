# 技能模块

本目录是Agent-1唯一正式技能承载目录。知识回答“应该知道什么”，Skill回答“面对任务执行哪套标准能力”，共享工具/数据/运行基础设施负责真实读取、调度与执行。

# 当前阶段结论

**S01-S10 的 V1.x 业务规则层与统一接口层已完成阶段性收口，可以冻结。**

本次冻结表示：
- 十个Skill的职责、规则、输入输出边界已经建立；
- 相邻Skill不再依赖Runner临时拼关键业务字段；
- S03→S04、S06→S07两个关键断点已经建立正式桥接；
- Task→ExecutionResult→ValidationResult→LearningRecord引用链已经统一；
- S10正式作为横向StrategyChain稳定器；
- 当前全部示例已迁移到统一接口；
- 后续重点转入系统运行层，而不是继续横向增加Markdown规则。

> 冻结不等于永不修改。V1.x后续变更按照`统一接口/V1x变更提案规则.md`处理。

## 十个正式Skill
| 编号 | 正式名称 | Code | 业务规则状态 | 当前接口状态 |
|---|---|---|---|---|
| S01 | 事件校验 | `EventValidation` | V1.x冻结 | V1.1：统一scope / normalized_event |
| S02 | 上下文装载 | `ContextLoading` | V1.x冻结 | V1.1：S01→ContextPackage |
| S03 | 冲突检测 | `ConflictDetection` | V1.1冻结 | V1.2：ContextPackage→DecisionItemBuilder |
| S04 | 决策排序 | `DecisionPrioritization` | V1.1冻结 | V1.2：Canonical DecisionItem |
| S05 | 方案生成 | `OptionGeneration` | V1.1冻结 | V1.2：DecisionItem + ContextPackage |
| S06 | 风险评估 | `RiskAssessment` | V1.1冻结 | V1.2：ContextPackage→DecisionSelector |
| S07 | 任务编排 | `TaskOrchestration` | V1.1冻结 | V1.2：FinalDecision→TaskPlan/Task |
| S08 | 结果验证 | `OutcomeValidation` | V1.1冻结 | V1.2：ExecutionResult→ValidationResult |
| S09 | 经验沉淀 | `LearningWriteback` | V1.1冻结 | V1.2：ValidationResult→LearningRecord |
| S10 | 策略防抖 | `StrategyStabilization` | V1.1冻结 | V1.2：StrategyChain/Stabilization |

## 正式目录
```text
技能模块/
├── README.md
├── 统一接口/
├── S01_事件校验/
├── S02_上下文装载/
├── S03_冲突检测/
├── S04_决策排序/
├── S05_方案生成/
├── S06_风险评估/
├── S07_任务编排/
├── S08_结果验证/
├── S09_经验沉淀/
└── S10_策略防抖/
```

# 正式主调用链
```text
Event
↓
S01 EventValidation
↓ normalized_event
S02 ContextLoading
↓ ContextPackage
S03 ConflictDetection
↓ Conflict[]
DecisionItemBuilder
↓ DecisionItem[]
S04 DecisionPrioritization
↓ Ranked DecisionItem[]
S05 OptionGeneration
↓ Option[]
S06 RiskAssessment
↓ RiskAssessment[]
DecisionSelector
↓ FinalDecision
S07 TaskOrchestration
↓ TaskPlan / Task[] / TaskGraph
调度 / 审批 / 执行
↓ ExecutionResult
S08 OutcomeValidation
↓ ValidationResult
S09 LearningWriteback
↓ LearningRecord[] / MemoryWritePlan
记忆与数据层
↓
下一轮观察
```

## S10不是主链第10步
当出现可能改变正在运行StrategyChain的新动作时横向调用：
```text
新Event / 新Option / 新Decision proposal
↓
必要时S03确认strategy conflict
↓
S10 StrategyStabilization
↓
allow / hold / merge / escalate / override
```

Runner禁止把S01-S10实现成简单固定for-loop。

# 统一接口层
`统一接口/`不是新增业务Skill，而是十个Skill之间的公共总线。

当前核心内容包括：
- `Skill统一调用协议.schema.json`
- `核心对象目录.md`
- `字段命名与引用规范.md`
- `Skill输入输出映射.md`
- `路由规则.md`
- `桥接组件规范.md`
- `DecisionItem.schema.json`
- `FinalDecision.schema.json`
- `Task.schema.json`
- `ExecutionResult.schema.json`
- `ValidationResult.schema.json`
- `LearningRecord.schema.json`
- `StrategyChain.schema.json`
- `DecisionItemBuilder.input.schema.json`
- `DecisionItemBuilder.output.schema.json`
- `DecisionSelector.input.schema.json`
- `DecisionSelector.output.schema.json`
- `总接口验收测试.md`
- `收口验收报告.md`
- `V1x变更提案规则.md`
- `示例/端到端_广告降竞价闭环.example.json`

# Canonical Business Objects
正式对象：
- Event
- ContextPackage
- Conflict
- DecisionItem
- Option
- RiskAssessment
- FinalDecision
- Task
- ExecutionResult
- ValidationResult
- LearningRecord
- StrategyChain

## 正式主键引用链
```text
event_id
→ decision_item_id
→ option_id
→ decision_id
→ task_plan_id
→ task_id
→ execution_result_id
→ validation_id
→ learning_id
```

`strategy_chain_id`横向贯穿策略生命周期。

`run_id / trace_id`属于Skill Invocation Envelope，不属于业务对象本身。

# 已废弃的新接口别名
新Schema、新示例和新运行代码不得继续使用：
- `item_id`代替`decision_item_id`
- `problem`代替`problem_definition`
- `actual_execution`代替`execution_result`
- `verification_result`代替`validation_result`
- S07顶层散装`selected_option + risk_assessment`
- 单独`product_id`作为所有场景唯一作用域模型

旧历史数据兼容交未来Adapter处理。

# 核心工程原则
1. Skill不直接硬编码Amazon API；
2. ContextPackage是当前决策上下文唯一事实源；
3. DecisionItemBuilder负责S03→S04问题成型；
4. S04只做业务优先级，不做任务执行排序；
5. S05生成方案，S06评估风险，DecisionSelector才形成FinalDecision；
6. S07不得自行选择Option或重算风险；
7. required_controls必须在S07实体化；
8. API/工具/人工结果必须先标准化为ExecutionResult；
9. S08区分执行成功、业务成功与归因可信度；
10. S09只形成Learning与MemoryWritePlan，不自行宣称数据库written；
11. S10管理StrategyChain稳定性，不机械阻止真正风险响应；
12. 所有业务链必须保留正式主键、证据、时间与版本追溯。

# 示例状态
S01-S10当前已有示例已全部迁移至统一接口。

统一接口层另有端到端引用链示例：
`统一接口/示例/端到端_广告降竞价闭环.example.json`

用于验证：
`Event → DecisionItem → Option → FinalDecision → Task → ExecutionResult → ValidationResult → LearningRecord`
并包含S10横向hold场景。

# 验收状态
`统一接口/总接口验收测试.md`包含T01-T90。

## 静态验收
T01-T80覆盖：
- Schema字段；
- 作用域；
- 唯一事实源；
- 桥接路由；
- 主键引用；
- 示例迁移；
- S10横向规则。

本轮已按该清单完成规则层/接口层静态收口。

## 动态验收
T81-T90必须等真实：
- Skill Runner
- Schema Validator
- Adapter
- Scheduler / Executor
- Memory Writer

实现后自动执行。

**当前不宣称T81-T90已经运行通过，也不以文档检查冒充代码测试。**

# V1.x冻结规则
V1.x当前进入阶段性冻结。

允许直接维护：
- 拼写/链接/目录引用；
- Schema语法错误；
- 示例与已批准Schema不一致；
- 无业务语义变化的测试补充；
- 历史数据Adapter；
- 运行时实现Bug修复。

必须走变更提案：
- 新增/删除Skill；
- 核心对象语义变化；
- 新增破坏性必填字段；
- 主键含义变化；
- 主调用链变化；
- 风险/审批/知识治理核心语义变化；
- Skill职责重新划分。

破坏性规则变化原则上进入V2。

# 下一阶段
技能模块不再作为当前主建设面。

下一步转入：
```text
系统运行层
↓
Schema Validator
↓
Skill Runner
↓
旧接口Adapter
↓
DecisionItemBuilder实现
↓
DecisionSelector实现
↓
ExecutionResultNormalizer
↓
StrategyChainBuilder
↓
LearningWriteExecutor
↓
运行T81-T90
↓
跑通第一条真实S01→S09 + S10横向链
```

## 最终状态
**技能模块 V1.x 规则层：阶段性封板。**