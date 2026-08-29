# 技能模块

本目录是 Agent-1 唯一正式技能承载目录。知识回答“应该知道什么”，技能回答“面对任务执行哪套标准能力”，工具负责真实数据与系统操作。

## 正式技能
| 编号 | 正式名称 | 代码名 | 核心作用 | 当前状态 |
|---|---|---|---|---|
| S01 | 事件校验 | `EventValidation` | 校验事件完整性、来源、对象和基本合法性 | V1.0规则与接口已建立 |
| S02 | 上下文装载 | `ContextLoading` | 建立最小充分决策上下文 | V1.0规则与接口已建立 |
| S03 | 冲突检测 | `ConflictDetection` | 识别事实、解释、目标、任务、策略和约束冲突 | V1.1 |
| S04 | 决策排序 | `DecisionPrioritization` | 确定问题、目标与待决事项处理顺序 | V1.1 |
| S05 | 方案生成 | `OptionGeneration` | 生成多个有实质差异的可执行候选方案 | V1.1 |
| S06 | 风险评估 | `RiskAssessment` | 评估方案风险、控制、残余风险与审批要求 | V1.1 |
| S07 | 任务编排 | `TaskOrchestration` | 把最终决策转成任务、责任、依赖、审批、观察和回滚 | V1.1 |
| S08 | 结果验证 | `OutcomeValidation` | 区分执行成功与业务成功，验证归因和经营结果 | V1.1 |
| S09 | 经验沉淀 | `LearningWriteback` | 分层沉淀事实、解释、经验和知识候选 | V1.1 |
| S10 | 策略防抖 | `StrategyStabilization` | 管理策略链，防止噪声导致频繁反转 | V1.1 |

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

## 统一接口层
`统一接口/` 负责把十个Skill真正焊接成一条可运行链，不是新增业务Skill。

当前包含：
- `Skill统一调用协议.schema.json`
- `核心对象目录.md`
- `Skill输入输出映射.md`
- `DecisionItem.schema.json`
- `FinalDecision.schema.json`
- `ExecutionResult.schema.json`
- `桥接组件规范.md`
- `路由规则.md`
- `总接口验收测试.md`

## 正式主调用链
```text
标准Event
↓
S01 事件校验
↓
S02 上下文装载
↓
状态识别 / 指标 / 知识匹配
↓
S03 冲突检测
↓
DecisionItemBuilder
↓
S04 决策排序
↓
S05 方案生成
↓
S06 风险评估
↓
Agent-1 DecisionSelector
↓
FinalDecision
↓
S07 任务编排
↓
调度 / 审批 / 执行
↓
ExecutionResult
↓
S08 结果验证
↓
S09 经验沉淀
↓
记忆与数据层
↓
进入下一轮观察
```

S10 策略防抖不是单纯排在末尾，而是横跨计划、执行、观察和验证阶段。当出现可能改变当前策略链的新动作时调用。

## Canonical Business Objects
统一接口层当前正式约定：
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
- LearningItem
- StrategyChain

公共对象不应在每个Skill中反复重新发明同义字段。

## 标准技能结构
每个技能原则上包含：
1. `README.md`：目的、边界、调用位置；
2. `输入规范.json`；
3. `输出规范.json`；
4. `判断规则.md`；
5. `异常处理.md`；
6. `示例/`；
7. `测试/验收测试.md`；
8. `执行程序/README.md`，后续替换/扩展为真实程序。

## 工程原则
- Skill 不直接硬编码 Amazon API；数据读取由数据接口层/工具层负责。
- 业务阈值优先从经营指标库和配置读取。
- Skill允许“信息不足/无法判断”作为合法结果。
- 高风险动作必须经过权限与审批机制。
- 所有决策链必须保留证据、时间、版本和可追溯关系。
- 规则层负责稳定边界，大模型负责需要语义理解、假设和方案创造的部分。
- ContextPackage是当前上下文唯一事实源。
- S06之后必须形成FinalDecision，S07不得自行选择方案。
- API/工具执行结果必须先标准化为ExecutionResult，再进入S08。
- S09只形成经验写回计划，真实持久化由记忆与数据层负责。
- S10横向控制策略链，Runner不得把S01-S10实现成简单for-loop。

## 当前建设状态
十个Skill的业务规格已基本建立，其中S03-S10已进入V1.1。当前已开始“总接口统一”，重点从继续增加Markdown规则转向：
1. 统一Skill调用协议；
2. 统一核心业务对象；
3. 固定相邻Skill输入输出映射；
4. 建立DecisionItemBuilder与DecisionSelector桥接；
5. 统一Task→ExecutionResult→ValidationResult→LearningItem链路；
6. 为Skill Runner提供明确路由规则与45项总接口验收测试。

下一阶段重点：把统一接口落实到各Skill Schema兼容升级，并在系统运行层实现第一版Skill Runner。