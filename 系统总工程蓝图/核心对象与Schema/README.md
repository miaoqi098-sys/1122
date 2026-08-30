# 核心对象 / Schema 统一 V1

> 状态：✅ V1 静态 Contract 阶段完成
> 上位来源：`系统总工程蓝图/工程需求反向拆解/首页六大区域_后台工程需求反向拆解_V1.md`
> 目标：建立跨 UI、业务、Agent、任务、执行、数据、记忆共同使用的系统级对象 Contract，避免同一概念在不同模块中各自定义。

## 一、Canonical原则
1. 系统级核心对象只允许存在一个 Canonical 语义定义；专业 Agent 可以扩展专业字段，但不得重新定义核心 ID、状态和跨对象关系。
2. UI 不直接把多个 Agent 的自然语言输出拼成业务对象；UI读取结构化对象或聚合 View。
3. 外部平台标识不是系统内部万能主键；跨模块引用优先使用内部稳定 ID。
4. 每个对象必须明确身份、字段、状态、生命周期、上游、下游、证据、时间、权限和引用规则。
5. 本目录承担 V1 Contract 正式设计承载；未来迁移必须保留 Canonical 引用与迁移说明。

## 二、完成状态
| 顺序 | 对象 | 状态 |
|---|---|---|
| 01 | ProductIdentity | ✅ |
| 02 | MetricSnapshot | ✅ |
| 03 | BusinessState + ProductStage | ✅ |
| 04 | Goal | ✅ |
| 05 | Event | ✅ 复用现有 Agent-1 Canonical Event，无第二套Schema |
| 06 | Task + Approval + HumanActionRequest | ✅ |
| 07 | Action + ExecutionResult | ✅ |
| 08 | AgentActivity | ✅ |
| 09 | Memory + StageSummary | ✅ |
| 10 | 核心对象关系链总回顾 | ✅ |

## 三、Canonical关联链
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
Goal
        ↓
TaskPlan → Task
        ↓
Approval / HumanActionRequest（适用时）
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

DecisionItem、Option、FinalDecision、ValidationResult、LearningRecord 已在 Agent-1 / Skill 链中存在较强 Canonical 雏形，本阶段不重复重写。

## 四、关键结论
- `product_id` 是全系统产品稳定主键；ASIN/SKU仅为外部标识。
- MetricSnapshot 统一事实窗口、来源、新鲜度、质量与利润完整度。
- BusinessState 与 ProductStage 分离。
- Goal 是系统级可引用目标对象，Agent-1继续拥有目标选择/排序/冲突/切换逻辑。
- Event 复用 Agent-1 `输入规范/智能事件包.schema.json` 与 `ProcessedEvent.schema.json`；专业 Agent 通过公共事件协议规范化。
- Task / Approval / HumanActionRequest 分离，为 TaskCenter 和首页人工任务提供公共 Contract。
- Task ≠ Action；Action ≠ ExecutionResult；ExecutionResult ≠ ValidationResult。
- AgentActivity 与 EngineeringLog / Action Ledger 分离。
- Memory / StageSummary 不覆盖原始历史，只做可追溯长期索引和阶段摘要。

## 五、总回顾
详见：`核心对象关系链总回顾_V1.md`。

结论：未发现需要推翻 Agent-1 已封板核心协议的冲突；可进入 TaskCenter / 聚合层 / 单产品纵向样板建设。

## 六、运行边界
本阶段只完成静态 Contract；真实数据库、API、Runtime、持久化、Scheduler、Executor、Amazon 写操作仍属于运行依赖。