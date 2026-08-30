# 核心对象 / Schema 统一 V1

> 状态：施工中
> 上位来源：`系统总工程蓝图/工程需求反向拆解/首页六大区域_后台工程需求反向拆解_V1.md`
> 目标：建立跨 UI、业务、Agent、任务、执行、数据、记忆共同使用的系统级对象 Contract，避免同一概念在不同模块中各自定义。

## 一、Canonical原则

1. 系统级核心对象只允许存在一个 Canonical 语义定义；专业 Agent 可以扩展专业字段，但不得重新定义核心 ID、状态和跨对象关系。
2. UI 不直接把多个 Agent 的自然语言输出拼成业务对象；UI读取结构化对象或聚合 View。
3. 外部平台标识（ASIN、SKU、Campaign ID 等）不是系统内部万能主键；跨模块引用优先使用内部稳定 ID。
4. 每个对象必须逐步明确：身份、字段、状态、生命周期、上游、下游、证据、时间、权限和引用规则。
5. 本目录当前承担 V1 Contract 的正式设计承载；未来若目标根目录实际迁移，必须保留 Canonical 引用与迁移说明，不能产生两套同时有效定义。

## 二、当前施工对象顺序

| 顺序 | 对象 | 状态 |
|---|---|---|
| 01 | ProductIdentity | ✅ L1通过 |
| 02 | MetricSnapshot | ✅ L1通过 |
| 03 | BusinessState + ProductStage | ✅ L1通过 |
| 04 | Goal | 🔎 下一施工对象 |
| 05 | Event | 待对接现有 Agent-1 事件体系 |
| 06 | Task + Approval + HumanActionRequest | 待分析 |
| 07 | Action + ExecutionResult | 待分析 |
| 08 | AgentActivity | 待分析 |
| 09 | Memory + StageSummary | 待分析 |
| 10 | 核心对象关系链总回顾 | 待分析 |

## 三、目标关联链

```text
SellerAccount / Marketplace
        ↓
ProductIdentity
        ↓
MetricSnapshot
        ↓
BusinessState / ProductStage
        ↓
Event
        ↓
DecisionItem → Option → FinalDecision
        ↓
Goal / TaskPlan / Task
        ↓
Approval（如需要）
        ↓
Action
        ↓
ExecutionResult
        ↓
ValidationResult
        ↓
LearningRecord
        ↓
Memory / StageSummary
        ↓
ProductStatusCardView / HomeCommandCenterView
```

其中 DecisionItem、Option、FinalDecision、ValidationResult、LearningRecord 已在 Agent-1 / Skill 链中存在较强雏形，后续需要通过系统级引用关系接入，不在本阶段盲目重写。

## 四、已建立正式Contract

### ProductIdentity
- 全系统稳定产品主键：`product_id`；
- ASIN/SKU 是外部标识，不作为跨模块万能主键；
- 已定义父子体/变体族引用边界。

### MetricSnapshot
- 统一事实快照：`product_id + business_date + time window`；
- 指标必须可追溯来源与 `effective_at`；
- freshness 与 quality 分离；
- 利润必须标记口径、完整度与成本模型版本。

### BusinessState
- 表达产品当前经营状态；
- 状态维度必须有证据引用；
- 保留评估规则版本与历史替代链。

### ProductStage
- 表达产品当前经营阶段；
- `stage_code` 与阶段定义版本分离；
- 尚未确认的阶段枚举不在 Schema 中擅自固化；
- 阶段切换与人工覆盖必须可审计。

## 五、目录约定

- `schemas/`：JSON Schema Contract。
- `规则/`：对象语义、引用、生命周期和跨模块规则。
- `示例/`：与 Schema 一致的静态示例。
- `测试/`：静态 Contract 验收。

## 六、运行边界

本阶段只建设静态 Contract，不实现数据库、API、运行时、持久化、Scheduler、Executor 或真实 Amazon 写操作。
