# 亚马逊政策边界

## 正式定位

1122 的 `亚马逊政策边界` 与 AACC 的 Product Operations Boundary Exploration / Policy Boundary 定义保持一致。

本板块不是单纯的“Amazon 政策文档库”，也不是只回答某个动作是否合规；它是一个**以版本化 Amazon 官方政策证据为 Expected State、以受控观测到的 Amazon 实际状态为 Observed State，通过证据门、差异识别、重复验证、替代解释审查与影响推演，持续识别和确认 Amazon 平台政策边界、实际边界结果及其经营影响的证据化边界探索系统**。

核心目标是：

1. 建立 Amazon 官方政策的版本化事实层；
2. 建立平台实际状态的受控观测层；
3. 比较 `EXPECTED_STATE` 与 `OBSERVED_STATE`；
4. 只有在差异满足显著性与持续性条件时才形成 `Boundary Signal`；
5. 通过政策证据、重复状态检查和替代解释审查，将信号升级为 `Boundary Candidate`；
6. 只有证据充分时才形成 `Confirmed Boundary Result Case`；
7. 将确认后的边界结果作为受控证据输入 Agent、Safety、Competitor、Tactics Library、Sandbox 与 Operations Strategy；
8. 本板块永远不因“技术上可行”或“暂未被处罚”而自动认定“政策允许”或授予执行权。

---

## 一、三大正式组件

1122 正式采用与 AACC 一致的三个顶层组件：

### 1. Amazon Policy Change Center

Amazon 政策变化中心。

负责建立和维护版本化 Amazon 官方政策事实，形成 `EXPECTED_STATE`。

至少负责：

- 官方政策来源与证据引用；
- 政策版本；
- 发布时间 / 生效时间 / 最后验证时间；
- 适用 Marketplace；
- 适用业务域；
- 适用对象（ASIN / Listing / Account / Ads / Promotion 等）；
- Policy Diff；
- 新旧政策的 supersession / replaced-by 关系；
- 冲突政策与证据状态；
- freshness / provenance / confidence；
- 对商品、经营策略、任务与风险事件的影响映射。

模型不得自行把推测、社区说法或单次现象升级为 Amazon 官方政策事实。

### 2. Amazon Boundary Result Library

Amazon 边界结果库。

负责保存**经过证据门确认的“结果型边界案例”**。

案例必须以“产生了什么结果”命名，而不是以“采用了什么路径 / 技巧 / 战术”命名。

例如允许记录：

- 某政策条件下 Featured Offer 状态结果；
- 某类促销条件下 Reference Price / eligibility 结果；
- 某类目录状态下 Variation / Catalog 结果；
- 某类广告/搜索/合规状态产生的可验证平台结果。

不得把边界结果库建设成：

- 规避政策手册；
- 可复制滥用步骤库；
- 账号 / 买家 / 凭据 / 路径定向操作库；
- 绕过处罚、风控、审核或平台限制的方法库。

### 3. Boundary Impact Sandbox

边界影响沙盘。

用于把已确认或高可信的边界结果抽象成经营压力 / 状态变化，并只针对**我方产品数字孪生**模拟其可能经营影响。

Boundary Impact Sandbox 必须复用 `沙盘演练板块` 的正式规则：

- 仅模拟我方 `LIVE_ASIN_DIGITAL_TWIN` / frozen twin version；
- Low / Base / High；
- 时间轴；
- R0 = NO_RESPONSE；
- 成本 / 效果 / 不确定性；
- Response Package；
- 最终只输出策略证据 / `REVISED_OPERATIONS_STRATEGY`；
- 永久不产生 Amazon / Ads / 财务 / 权限生产执行权。

---

## 二、Expected State 与 Observed State 必须分离

正式边界识别必须保留两个独立事实面：

### EXPECTED_STATE

只能由**版本化政策证据**构建，例如：

- Amazon Seller Central 官方政策；
- Amazon Help / Policy 页面；
- Amazon 官方 API / Ads 文档；
- Amazon 官方通知 / Case / Enforcement 文书；
- 经确认的官方政策版本记录。

### OBSERVED_STATE

只能由**受控观测证据**构建，例如：

- 我方账号 / 商品真实只读状态；
- 经验证的 Amazon API / Seller Central / Ads 状态；
- 重复观测到的平台结果；
- 有 provenance / observed_at / freshness 的结果证据。

两者不得互相覆盖，也不得因为观测到一次不同结果就反推政策已经改变。

标准关系：

```text
Policy Evidence
      ↓
EXPECTED_STATE
      │
      │ compare
      ▼
OBSERVED_STATE
      ↓
Difference
```

---

## 三、Difference 不等于 Boundary Signal

`EXPECTED_STATE != OBSERVED_STATE` 只代表存在差异。

只有当差异同时满足明确的：

- Materiality（显著性）；
- Persistence（持续性）；
- Scope Consistency（适用范围一致性）；
- Evidence Quality（证据质量）；

才允许升级为：

`BOUNDARY_SIGNAL`

否则必须保留为：

- Observation；
- Noise；
- Insufficient Evidence；
- Needs Recheck。

不得把单次异常、缓存、延迟、实验状态、界面差异或数据噪声自动解释为“Amazon 边界变化”。

---

## 四、Boundary Candidate 证据门

Boundary Signal 要成为 `Boundary Candidate`，至少必须完成：

1. **Policy Evidence Check**
   - 当前政策证据是否明确；
   - 版本是否有效；
   - 适用 Marketplace / Domain 是否一致。

2. **Repeated State Check**
   - 是否经过重复状态确认；
   - 是否跨时间仍存在；
   - 是否排除短暂延迟 / 缓存 / UI 状态。

3. **Alternative Explanation Review**
   - 是否可能由库存、价格、广告、账号状态、实验、资格、类目、区域等其他变量造成；
   - 是否存在更合理解释。

缺失、冲突或无法验证任一关键证据时必须 fail-closed，不得形成 Confirmed Boundary Result。

---

## 五、Confirmed Boundary Result Case

只有经过完整证据门后，才允许形成：

`CONFIRMED_BOUNDARY_RESULT_CASE`

正式案例必须至少包含：

```text
BoundaryResultCase
├── case_id
├── domain
├── marketplace
├── expected_state
├── observed_state
├── policy_evidence_refs
├── observed_evidence_refs
├── first_observed_at
├── last_verified_at
├── persistence_evidence
├── alternative_explanations_reviewed
├── result_class
├── confidence
├── applicability_scope
├── sustainability_status
└── execution_authorized = false
```

案例按**结果**命名，不按具体操作路径命名。

---

## 六、四个概念必须永久分开

1122 正式继承 AACC 的硬边界：

`TECHNICALLY_POSSIBLE != POLICY_ALLOWED != NOT_CURRENTLY_PUNISHED != LONG_TERM_SUSTAINABLE`

即：

### TECHNICALLY_POSSIBLE
技术上能不能做到。

### POLICY_ALLOWED
Amazon 官方政策是否允许。

### NOT_CURRENTLY_PUNISHED
当前观测中是否暂未出现处罚 / 拦截。

### LONG_TERM_SUSTAINABLE
长期经营是否可持续、稳定、低风险。

任何一项都不得自动推导其他项。

尤其禁止：

> “现在能做” → “Amazon 允许”

或：

> “目前没处罚” → “长期安全”

---

## 七、V1 18 个正式边界域

1122 第一版 Amazon 边界域采用 AACC 的 18 域白名单：

1. Review
2. Variation
3. Catalog
4. Offer
5. Featured Offer
6. Pricing
7. Promotion
8. Advertising
9. Search
10. BSR
11. Brand
12. Content
13. Inventory
14. Logistics
15. Returns
16. Account
17. Compliance
18. Enforcement

新的 Domain 不得在没有正式架构变更的情况下自行扩展。

---

## 八、与政策变化中心的关系

政策变化与边界探索是两件不同的事：

```text
Amazon 官方政策变化
        ↓
Policy Change Center
        ↓
更新 EXPECTED_STATE
        ↓
与 OBSERVED_STATE 对比
        ↓
Boundary Signal / Candidate / Result
```

Policy Diff 可以触发：

- Agent-12 风险合规智能体；
- Agent-1 运营总控；
- 商品/ASIN 影响分析；
- Task / Decision 重新评估；
- Safety Event Center；
- Boundary Impact Sandbox。

但 Policy Diff 本身不自动产生生产执行动作。

---

## 九、与 Agent / Safety / Competitor / Tactics / Sandbox 的关系

Confirmed Boundary Result 只作为**受控证据和结果抽象**向下游传播。

允许进入：

- Agent-12 Risk & Compliance；
- Agent-1 Operations Commander；
- Safety Event Center；
- Competitor Monitoring；
- Tactics Library；
- Tactical / Boundary Impact Sandbox；
- Operations Strategy。

禁止输出：

- 原始滥用教程；
- 规避 / 绕过步骤；
- 可复制攻击流程；
- 凭据 / 买家 / 账号定位；
- 任意 URL / 命令 / 脚本；
- 未经审批的 Amazon / Ads / 财务 / 权限写操作。

---

## 十、与 1122 内部政策边界板块的职责分离

`亚马逊政策边界/` 与 `政策边界板块/` 必须永久分离：

### 亚马逊政策边界
回答：

- Amazon 官方政策期望什么？
- Amazon 当前实际表现是什么？
- 两者是否存在可验证差异？
- 这个差异是否构成真正的 Boundary Signal / Result？
- 该结果对我方经营有什么影响？

### 政策边界板块
回答：

- 1122 是否允许执行？
- 谁可以执行？
- 是否需要人工审批？
- 权限级别是什么？
- 哪个 Executor 可以执行？
- 哪些动作必须 fail-closed？

因此：

`Amazon Policy Allowed` **不等于** `1122 Execution Authorized`。

---

## 十一、Truth Boundary

必须严格区分：

- Policy document exists；
- Policy evidence verified；
- Observed state collected；
- Boundary signal detected；
- Boundary candidate verified；
- Confirmed boundary result；
- Runtime verified；
- Live data verified；
- Business loop verified；
- Execution authorized。

任何前一级都不得静默冒充后一级。

---

## 十二、正式数据流

```text
Amazon Policy / Official Evidence
              ↓
     Amazon Policy Change Center
              ↓
        EXPECTED_STATE
              │
              ├───────────────┐
              │               │
              ▼               ▼
       OBSERVED_STATE      Policy Diff
              │
              ▼
          Difference
              ↓
   Materiality / Persistence Gate
              ↓
       BOUNDARY_SIGNAL
              ↓
Policy Evidence + Recheck + Alternative Review
              ↓
      BOUNDARY_CANDIDATE
              ↓
CONFIRMED_BOUNDARY_RESULT_CASE
              ↓
 ┌────────────┼──────────────┬──────────────┐
 ▼            ▼              ▼              ▼
Agent-12   Safety Event   Tactics/Comp   Boundary Sandbox
 └────────────┴──────────────┴──────────────┘
                       ↓
                Operations Strategy
                       ↓
                    Agent-1
                       ↓
             1122 内部权限治理链
                       ↓
                 Approval / Permission
```

---

## 十三、正式定义总结

> **1122 亚马逊政策边界 = 与 AACC 一致的 Amazon 平台边界探索与证据验证系统。系统以版本化 Amazon 官方政策构建 `EXPECTED_STATE`，以受控真实观测构建 `OBSERVED_STATE`，通过显著性/持续性门、重复状态检查与替代解释审查，将差异逐级验证为 Boundary Signal、Boundary Candidate 和 Confirmed Boundary Result Case；确认结果按“结果”而非“操作路径”记录，并可进入 Agent、Safety、Competitor、Tactics、Sandbox 和 Operations Strategy。系统永久保持 `TECHNICALLY_POSSIBLE != POLICY_ALLOWED != NOT_CURRENTLY_PUNISHED != LONG_TERM_SUSTAINABLE`，且 Amazon 平台边界结论永远不直接授予 1122 生产执行权限。**
