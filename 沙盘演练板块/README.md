# 沙盘演练板块

## 正式定义

1122 的沙盘演练板块与 AACC（Amazon Agent Command Center）的沙盘演练定义保持一致。

沙盘演练板块不是单纯的“执行前 What-if 计算器”，也不是直接生成生产执行命令的决策后置步骤；它是一个**以我方产品数字孪生为唯一模拟主体，对外部竞争压力、市场变化、经营战术及其组合影响进行可重复、可审计、可解释、不可越权执行的经营自我推演系统**。

其核心目标是：在不改变真实 Amazon / Ads / 财务 / 库存 / Listing / 权限状态的前提下，将真实经营事实和专业 Agent 观察转化为可复现的沙盘场景，对我方产品未来经营状态进行 Low / Base / High 多情景推演，比较 `R0 = NO_RESPONSE` 与不同合规响应包的结果，并最终输出 `REVISED_OPERATIONS_STRATEGY` 供 Agent-1 与后续正式决策链使用。

---

## 一、模拟主体原则

沙盘唯一正式模拟主体为：

`OUR_PRODUCT_SELF_SCENARIO / LIVE_ASIN_DIGITAL_TWIN`

即：**模拟的是我方自己的产品 / ASIN 数字孪生，而不是对真实竞品进行执行性模拟。**

真实竞品、市场、广告环境、价格变化、用户反馈、政策变化等只能作为：

- Observation Input（观察输入）
- Pressure Signal（压力信号）
- Scenario Input（场景输入）
- Evidence / Provenance（证据与来源）

不得将真实竞品 ASIN 作为沙盘执行对象，不得生成针对真实竞品的操作步骤、规避方法、买家/账号协调、供应商渠道或其他可执行的非合规指导。

---

## 二、数字孪生绑定与可复现性

每一次正式沙盘运行必须绑定一个冻结的我方数字孪生版本：

`frozen_twin_version`

沙盘输入至少应能够追溯到：

- Product / ASIN Identity
- Listing / Offer / Price
- Orders / Revenue
- Traffic / CVR
- Advertising
- Keywords / Rank
- Reviews / Rating
- Inventory / Logistics
- Promotions
- Cost / Profit / Margin
- Competitor Pressure
- Safety / Compliance
- Operation Stage
- Current Strategy

任何权威数据迟到或事实修正都必须生成新的 Twin Version，不得静默覆盖历史沙盘输入。

因此，同一 SimulationRun 必须能够回答：

- 当时使用的是哪个 `twin_version`
- 使用了哪些事实、证据和假设
- 使用了哪个 Scenario / Tactic Card 版本
- 为什么得到当时的模拟结果

---

## 三、三个顶层沙盘模块

1122 沙盘演练正式采用与 AACC 一致的三模块模型：

### 1. NONCOMPLIANT_TACTIC_SANDBOX

非合规竞争压力沙盘。

用于模拟“如果市场中出现某类非合规或异常竞争压力，我方产品会受到怎样的经营影响”。

该模块只允许抽象业务影响建模，例如：

- 流量压力
- CVR 压力
- 排名压力
- CPC 压力
- 收入 / 利润压力
- 恢复时间
- 证据准备与平台申诉/升级需求

非合规战术可以被模拟为压力，但永远：

- `simulation_only = true`
- `execution_authority = PERMANENTLY_BLOCKED`
- `can_generate_execution_steps = false`

不得将非合规模拟内容转换为真实执行步骤。

### 2. PURE_BUSINESS_SANDBOX

纯经营战术沙盘。

用于模拟合规经营变量对我方产品的影响，包括但不限于：

- Price
- Advertising
- Promotion
- Content / Listing
- Inventory
- Differentiation
- Traffic allocation
- Profit / margin constraint

即使某个 Tactic Card 在独立战术库中属于理论可执行经营动作，**沙盘自身仍然只负责模拟和推荐，不负责执行。**

### 3. COMBINED_IMPACT_RESPONSE_MODEL

综合影响与响应模型。

用于将多个外部压力和我方经营动作放入同一模型，比较：

- `R0 = NO_RESPONSE`
- Response Package A
- Response Package B
- Response Package C
- 其他被允许的合规响应组合

并综合比较：

- Traffic
- CVR
- Orders
- Revenue
- Contribution Profit
- Rank
- CPC
- Inventory
- Recovery Time
- Cost
- Risk
- Confidence
- Reversibility
- Net Protection Value
- Response ROI

最终输出 `REVISED_OPERATIONS_STRATEGY`。

---

## 四、Tactic Card 模型

沙盘中的经营/压力动作统一抽象为版本化 Tactic Card。

Tactic Card 至少应表达：

- Card Identity / Version
- Classification
- `EXECUTABLE | ADVERSARIAL_REFERENCE`
- `simulation_only`
- `execution_authority`
- Enablement
- Applicable Stage
- Entry Conditions
- Exit Conditions
- Occurrence Count
- Quantity / Scale per Occurrence
- Frequency
- Time
- Cost Assumptions
- Effect Assumptions
- Success Probability
- Confidence
- Provenance

**发生次数与单次规模必须分离，成本与效果必须分离。**

不得使用“花费 X 就必然带来排名 Y”之类确定性伪因果规则。

---

## 五、时间轴引擎

沙盘影响必须按时间展开，而不是使用单一静态百分比。

标准生命周期：

`Occurrence → Effect Lag → Ramp → Peak → Stop → Carryover → Decay`

用于表达：

- 动作什么时候发生
- 影响什么时候开始
- 影响如何爬坡
- 峰值何时出现
- 动作停止后是否仍有残留效应
- 影响如何衰减与恢复

---

## 六、成本、效果与不确定性

每个正式沙盘必须保留独立的成本模型与效果模型。

成本模型可包括：

- Fixed Cost
- Unit Cost
- Product Cost
- Amazon Fee
- Service Cost
- Refund Cost
- Capital Cost
- Other Cost

效果模型只记录相关经营维度，并使用：

- Low
- Base
- High
- Success Probability
- Confidence

假设不得伪装成已验证市场事实，必须保留 provenance 与 confidence。

---

## 七、多卡叠加与冲突

正式沙盘必须支持多个 Tactic Card 同时存在，并显式处理：

- Synergy
- Overlap
- Conflict
- Cannibalization
- Constraint Interaction

不得简单把多个效果百分比直接相加，避免重复计算和虚假放大。

---

## 八、反事实基线 R0

每次正式沙盘必须保留反事实基线：

`R0 = NO_RESPONSE`

R0 表示：在当前冻结数字孪生与已知压力下，如果我方不采取新增响应动作，经营状态预计如何演化。

所有 Response Package 必须优先与 R0 比较，而不是只比较方案 A 与方案 B。

核心问题是：

**相对于什么都不做，这个响应包真正保护了多少经营价值、增加了多少成本、引入了多少风险。**

---

## 九、输出边界

沙盘正式输出为模拟结果、响应评估和修订后的经营策略，而不是生产执行命令。

标准终点：

`REVISED_OPERATIONS_STRATEGY`

沙盘级权限必须始终保持：

- `execution_enabled = false`
- `action_request_authorized = false`
- `amazon_write = false`
- `ads_write = false`
- `financial_mutation = false`
- `permission_mutation = false`

沙盘不得因为模拟结果“看起来很好”而自动跳过 Agent-1、Decision、Task、Approval、Permission 等正式经营链路。

---

## 十、与 Agent-1 / 决策链的关系

沙盘不是简单插在 `Decision Formation → TaskDraft` 之间的单一步骤，而是 Agent 决策体系旁边的独立经营实验室。

正式关系：

```text
真实经营事实
    ↓
数据板块 / Canonical Facts
    ↓
我方 Product Digital Twin
    ↓
┌──────────────────────┬──────────────────────┐
│                      │                      │
专业 Agent 分析        沙盘演练               规则 / 政策判断
│                      │                      │
└──────────────────────┴──────────────────────┘
                       ↓
                    Agent-1
                       ↓
                 Decision Formation
                       ↓
                    TaskDraft
                       ↓
                  Approval Gate
                       ↓
               Permission Boundary
                       ↓
                    Executor
```

Agent-1 可以根据事件、决策问题或经营策略需要调用沙盘；沙盘结果作为 Agent-1 的结构化经营证据与策略输入，不自动取得执行权。

---

## 十一、SimulationRun 最低证据结构

建议每次正式沙盘至少保存：

```text
SimulationRun
├── simulation_run_id
├── frozen_twin_version
├── scenario_type
├── scenario_version
├── tactic_card_versions
├── assumptions
├── provenance
├── confidence
├── timeline
├── cost_model
├── effect_model
├── R0_result
├── low_result
├── base_result
├── high_result
├── response_packages
├── recommended_strategy
└── execution_enabled = false
```

目标是确保沙盘具备：

- 可重复
- 可解释
- 可审计
- 可复盘
- 可比较
- 可学习

---

## 十二、1122 正式定义总结

> **1122 沙盘演练板块 = 与 AACC 相同的、以我方产品数字孪生为唯一模拟主体的经营与竞争压力自我推演系统。系统通过 Scenario、Tactic Card、Timeline、Cost / Effect、不确定性、多卡叠加、反事实 R0 与 Response Package，对我方未来经营状态进行可复现模拟，最终输出 `REVISED_OPERATIONS_STRATEGY`；沙盘自身永久不拥有 Amazon / Ads / 财务 / 库存 / Listing / 权限等生产执行权。**
