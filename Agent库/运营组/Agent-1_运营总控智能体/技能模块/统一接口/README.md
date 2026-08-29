# S01-S10 统一接口层

## 定位
本目录不是新增业务 Skill，而是 S01-S10 之间的公共接口层。

目标是解决：
- 每个 Skill 自己定义输入输出，字段逐步漂移；
- 相邻 Skill 之间需要运行器临时拼字段；
- 同一业务对象在多个 Skill 中重复定义；
- S03→S04、S06→S07 存在正式接口断点；
- S10 横向介入无法用简单线性流水线表达。

## 核心组成
```text
统一接口/
├── README.md
├── Skill统一调用协议.schema.json
├── 核心对象目录.md
├── Skill输入输出映射.md
├── DecisionItem.schema.json
├── FinalDecision.schema.json
└── 路由规则.md
```

## 统一原则
1. Skill 自身只定义专业能力，不重新发明公共运行字段。
2. 所有 Skill 调用外层统一使用 Skill Invocation Envelope。
3. 业务对象使用 canonical object，Skill 只引用或扩展，不重复创造同义字段。
4. Context Package 是上下文唯一事实源；其他快捷字段是派生视图，不得成为第二事实源。
5. S03 不直接产出最终决策，但必须能为 DecisionItemBuilder 提供冲突与问题证据。
6. S06 不直接选择最终方案；最终方案选择由 Agent-1 大脑形成 FinalDecision。
7. S07 只接受已形成 FinalDecision 的 selected_option 和对应 risk_assessment。
8. S10 是横向控制 Skill，不参与简单 S01→S10 for-loop。
9. 所有转换必须显式、可追溯、可测试，不允许运行器静默改字段含义。

## 目标调用形态
```text
智能事件
↓
S01 EventValidation
↓
S02 ContextLoading
↓
状态识别 / 指标 / 知识匹配
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
Agent-1 DecisionSelector
↓
FinalDecision
↓
S07 TaskOrchestration
↓
调度 / 审批 / 执行
↓
S08 OutcomeValidation
↓
S09 LearningWriteback

S10 StrategyStabilization：在产生可能改变当前策略的新动作时横向调用。
```

## 当前阶段
V1.0 总接口统一骨架。下一阶段由 Skill Runner 和 Agent Runner 实际加载这些协议。