# S01-S10 统一接口层

## 定位
本目录不是新增业务Skill，而是S01-S10之间的公共接口层，用于统一调用协议、Canonical业务对象、桥接组件、字段命名、引用链和路由。

## 当前状态
**V1.x规则层接口收口已完成（静态）。**

已完成：
- S01-S10 Schema逐项对齐；
- 统一作用域scope；
- ContextPackage唯一事实源；
- DecisionItemBuilder / DecisionSelector正式输入输出；
- FinalDecision→S07；
- Task→ExecutionResult→ValidationResult→LearningRecord引用链；
- StrategyChain与S10横向控制；
- 当前全部Skill示例迁移；
- 静态总接口验收；
- V1.x冻结与变更提案规则。

尚未完成的动态部分属于系统运行层：Skill Runner、Schema Validator、Adapter、执行器与T81-T90自动运行测试。

## 目录核心文件
```text
统一接口/
├── README.md
├── Skill统一调用协议.schema.json
├── 核心对象目录.md
├── 字段命名与引用规范.md
├── Skill输入输出映射.md
├── 路由规则.md
├── 桥接组件规范.md
│
├── DecisionItem.schema.json
├── FinalDecision.schema.json
├── Task.schema.json
├── ExecutionResult.schema.json
├── ValidationResult.schema.json
├── LearningRecord.schema.json
├── StrategyChain.schema.json
│
├── DecisionItemBuilder.input.schema.json
├── DecisionItemBuilder.output.schema.json
├── DecisionSelector.input.schema.json
├── DecisionSelector.output.schema.json
│
├── 总接口验收测试.md
├── 收口验收报告.md
├── V1x变更提案规则.md
└── 示例/
    └── 端到端_广告降竞价闭环.example.json
```

## 正式主链
```text
Event
↓
S01 EventValidation
↓
S02 ContextLoading
↓
S03 ConflictDetection
↓
DecisionItemBuilder
↓
S04 DecisionPrioritization
↓
S05 OptionGeneration
↓
S06 RiskAssessment
↓
DecisionSelector
↓
FinalDecision
↓
S07 TaskOrchestration
↓
调度 / 审批 / 执行
↓
ExecutionResult
↓
S08 OutcomeValidation
↓
ValidationResult
↓
S09 LearningWriteback
↓
LearningRecord / MemoryWritePlan
↓
记忆与数据层
```

S10 StrategyStabilization横向介入正在运行的StrategyChain，不参与简单S01→S10固定for-loop。

## 正式主键链
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

`strategy_chain_id`横向贯穿策略生命周期；`run_id / trace_id`属于Skill Invocation Envelope，不属于业务对象主键。

## 统一原则
1. 所有Skill调用外层统一使用Skill Invocation Envelope。
2. 同一概念只保留一个正式字段名。
3. ContextPackage是当前决策上下文唯一事实源。
4. S03必须经过DecisionItemBuilder才能进入S04待决事项排序。
5. S06必须经过DecisionSelector形成FinalDecision，S07不得自行选方案。
6. 工具/API结果必须标准化为ExecutionResult，再进入S08。
7. S08生成正式ValidationResult与validation_id。
8. S09只生成学习与写回计划，不自行宣称数据库written。
9. S10通过StrategyChain处理hold/merge/override等策略稳定问题。
10. 历史旧字段兼容由未来Adapter处理，不污染Canonical Schema。

## 验收说明
`总接口验收测试.md`包含T01-T90：
- T01-T80：静态规则/Schema/示例/引用验收，本轮收口已按清单完成；
- T81-T90：真实运行验收，等待Skill Runner等运行基础设施后自动执行。

在真实Runner存在前，不宣称动态测试已经自动运行通过。

## 冻结状态
V1.x规则层进入阶段性冻结。

允许直接维护：拼写、链接、Schema语法、无语义测试补充、Adapter兼容等。

涉及新Skill、核心对象语义、必填字段、主路由、审批/风险语义等变更，必须遵循`V1x变更提案规则.md`。

## 下一阶段
转入`系统运行层`：
1. Schema Validator；
2. Skill Runner；
3. 旧接口Adapter；
4. DecisionItemBuilder实现；
5. DecisionSelector实现；
6. ExecutionResultNormalizer；
7. StrategyChainBuilder；
8. LearningWriteExecutor；
9. 自动执行T81-T90；
10. 跑通第一条真实S01→S09 + S10横向链。