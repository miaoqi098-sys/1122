# 亚马逊运营每日工作 SOP V2.0

## 1. 定位

每日工作 SOP V2 不再是“每天检查哪些指标”的清单，而是产品推广计划的日度决策执行层。

V2 核心由四个引擎组成：

1. **Signal Engine**：今天发生了什么；
2. **Root Cause Engine**：为什么发生；
3. **Action Engine**：今天应该做什么 / 不该做什么；
4. **Validation Engine**：昨天或前几天做的动作是否有效。

完整链路：

```text
读取 ProductPromotionPlan V2
        ↓
读取 D1 / Ads / Sif / 库存 / 价格 / Review
        ↓
Signal Engine
        ↓
Root Cause Engine
        ↓
Action Engine
        ↓
Decision Item / Task
        ↓
人工审批 / 受控执行
        ↓
Validation Engine
        ↓
更新计划 / 阶段 / 瓶颈
```

---

# 2. 每日先读取“战略上下文”

每日开始必须先读取：

- Current Stage；
- Stage Confidence；
- Primary Constraint；
- Primary Goal；
- Target KPI；
- Inventory / Profit / Price / Policy Constraints；
- 当前 Strategy；
- Avoid Actions；
- 最近执行过的动作；
- Action Cooldown；
- 下一阶段条件。

没有推广计划时可以做健康检查，但不得自行假定产品目标。

---

# 3. Signal Engine

Signal 只描述“发生了什么”，不直接等于原因。

支持信号至少包括：

## 销售
- `SALES_DROP_WARNING`
- `SALES_SURGE`
- `TARGET_MISS`
- `ORGANIC_SHARE_DROP`

## 流量与转化
- `TRAFFIC_DROP`
- `TRAFFIC_SURGE`
- `CTR_DROP`
- `CVR_DROP`
- `TRAFFIC_QUALITY_DROP`

## 广告
- `AD_SCALE_CANDIDATE`
- `AD_WASTE_CANDIDATE`
- `HARVEST_TO_EXACT_CANDIDATE`
- `AD_OVERLAP_REVIEW`
- `BUDGET_LIMITING_GROWTH`

## 关键词
- `KEYWORD_RANK_GAIN`
- `KEYWORD_RANK_DROP`
- `KEYWORD_TARGET_REACHED`
- `KEYWORD_TARGET_MISS`

## 库存
- `STOCKOUT_RISK`
- `REPLENISHMENT_REVIEW`
- `HOLD_SCALE`
- `SECOND_SELLER_HANDOFF_REVIEW`

## 价格与促销
- `PRICE_HEALTH_RISK`
- `REFERENCE_PRICE_RISK`
- `DEAL_PRICE_SPACE_RISK`
- `OTHER_SELLER_LOW_PRICE_ALERT`

## Listing / VOC / 政策
- `LISTING_SUPPRESSED`
- `LISTING_CONTENT_DRIFT`
- `VARIATION_BREAK`
- `NEGATIVE_REVIEW_ALERT`
- `VOC_CLUSTER_FOUND`
- `ACCOUNT_HEALTH_CRITICAL`
- `POLICY_ACTION_REQUIRED`

每条 Signal 必须带：

- fact；
- evidence_window；
- evidence_refs；
- severity；
- confidence；
- affected_goal；
- stage_relevance。

---

# 4. Root Cause Engine

## 4.1 原则

禁止：

```text
销量下降 → 直接判断广告有问题
```

必须走根因树。

## 4.2 销量下降根因树

```text
Sales ↓
│
├── Sessions ↓ ?
│   │
│   ├── Impressions ↓
│   │   ├── Keyword Rank ↓
│   │   ├── Ads Exposure ↓
│   │   ├── Budget Exhausted
│   │   └── Market Demand ↓
│   │
│   └── CTR ↓
│       ├── Main Image
│       ├── Price
│       ├── Rating
│       ├── Title / SERP message
│       └── Competitor Promotion
│
└── CVR ↓ ?
    ├── Price
    ├── Review / Rating
    ├── Listing persuasion
    ├── Delivery / Availability
    ├── Traffic quality
    ├── Variant / Buyable issue
    └── Competitive pressure
```

## 4.3 广告效率恶化根因树

```text
ACOS / TACOS ↑
│
├── CPC ↑
│   ├── competition ↑
│   └── placement mix change
│
├── CVR ↓
│   ├── low-quality search terms
│   ├── price / review / listing
│   └── traffic expansion too fast
│
├── ad sales ↓
│   ├── rank / demand decline
│   └── budget / serving issue
│
└── organic sales ↓
    └── TACOS 被动恶化
```

## 4.4 排名下降根因树

检查：

- 成交是否下降；
- CVR是否下降；
- 广告覆盖是否下降；
- 竞品是否加强；
- 价格是否失去竞争力；
- 库存 / Buyable 是否异常；
- 是否有大改Listing；
- 数据采样是否可靠。

Root Cause Engine 输出：

- `root_cause_candidates`
- `primary_root_cause`
- `confidence`
- `supporting_evidence`
- `contradicting_evidence`
- `missing_evidence`

当证据不足时输出 `UNRESOLVED / NEEDS_DATA`。

---

# 5. Action Engine

Action Engine 不能单看 Signal，而必须读取：

```text
Current Stage
+
Primary Constraint
+
Signal
+
Root Cause
+
Goals
+
Business Constraints
+
Recent Actions
+
Cooldown
```

输出：

- `recommended_action`
- `why`
- `expected_result`
- `observation_window`
- `stop_condition`
- `avoid_actions`
- `approval_level`

## 5.1 示例

### VALIDATION + CONVERSION_CONSTRAINT + CVR_DROP

优先：

- 检查高流量低转化词；
- 检查价格 / Rating / Review；
- 检查主图与页面说服力；
- 保持有效Exact；
- 收缩明显低相关Discovery。

避免：

- 大幅扩Broad；
- 同时改价格、主图、广告；
- 因单日数据大改Bid。

---

### GROWTH + KEYWORD_RANK_CONSTRAINT + KEYWORD_TARGET_MISS

优先：

- P0 Exact保障；
- 收割成交Discovery；
- Placement / Budget资源向P0倾斜；
- 保持已验证的价格与Listing。

避免：

- 无原因大改Listing；
- 大规模扩展不相关流量。

---

### GROWTH/SCALE + INVENTORY_CONSTRAINT + STOCKOUT_RISK

优先：

- HOLD_SCALE；
- 保护P0核心词；
- 降低P2 / Discovery；
- 补货 / 第二Seller接力评估。

避免：

- 大促；
- 大幅加预算；
- 激进低价。

---

# 6. Validation Engine

每个执行动作必须进入验证队列。

动作执行时记录：

- baseline；
- executed_at；
- expected_result；
- observation_window；
- guardrail；
- rollback_condition。

到验证窗口后，比较：

```text
Before
vs
After
vs
Expected
```

输出：

- `POSITIVE`
- `NEUTRAL`
- `NEGATIVE`
- `INSUFFICIENT_DATA`
- `SIDE_EFFECT_DETECTED`

Validation 结果必须影响后续策略：

```text
POSITIVE → 可继续 / 扩大
NEUTRAL → 继续观察 / 换动作
NEGATIVE → 停止 / 回滚 / 重新诊断
SIDE_EFFECT → 立即重新评估
```

---

# 7. 防止过度运营

V2 强制增加：

- `action_cooldown`
- `change_collision_check`
- `minimum_sample_check`
- `no_action_allowed`

规则：

- 单日异常通常只生成 Signal；
- 同一对象刚修改后进入观察期；
- Listing大改后避免同步大调价格与广告；
- Bid调整记录 old/new；
- 同一目标不得多个动作同时改变多个核心变量，除非明确标记为组合实验；
- 没有足够样本时允许 `KEEP_OBSERVING`；
- “今天无需修改”是合法结论。

---

# 8. 每日优先级

## P0
账户 / 政策 / Listing不可售 / 严重断货 / 严重价格健康 / 数据系统故障。

## P1
销量、CVR、核心词、预算、大促等当天需处理的经营偏差。

## P2
搜索词收割、Listing优化、竞品响应、新词扩展。

## P3
观察、研究、创意测试。

优先级还必须结合当前 Stage：

例如 SCALE 阶段库存风险优先级高于广告扩量。

---

# 9. Daily Operating Brief V2

每天输出：

## 9.1 Strategy Context
- Current Stage
- Stage Confidence
- Primary Constraint
- Primary Goal
- Current Strategy
- Avoid Actions

## 9.2 Executive Summary
- overall_status
- today_focus
- blocked_by

## 9.3 Signals
每条含事实、窗口、严重度、关联目标。

## 9.4 Root Cause
每个高优先信号必须给：
- primary_root_cause
- alternatives
- confidence
- evidence
- missing_evidence

## 9.5 Actions
每条必须给：
- Action
- Why
- Evidence
- Expected Result
- Observation Window
- Stop Condition
- Avoid If
- Approval Level

## 9.6 Validation
复核以前动作：
- 是否成功
- 是否达到预期
- 是否有副作用
- 是否继续
- 是否回滚
- 是否更新推广计划

## 9.7 Stage Review
每天不强制切阶段，但检查：
- transition_candidate
- regression_candidate
- constraint_changed
- strategy_refresh_required

---

# 10. 每日时间逻辑

## 第一轮：风险与数据
1. 数据新鲜度
2. P0风险
3. 库存 / Buyable / 价格
4. 昨日销售 / Sessions / CVR
5. 广告预算异常

## 第二轮：诊断
1. Signal Engine
2. Root Cause Engine
3. Constraint变化
4. Stage相关性
5. 竞品 / Review / Listing

## 第三轮：动作
1. 生成Action候选
2. 检查Cooldown
3. 检查冲突动作
4. 生成Decision Item
5. 排优先级

## 第四轮：日结
1. 今日执行
2. Validation队列
3. 明日观察
4. 是否更新推广计划
5. 是否出现阶段切换候选

---

# 11. GPT / Agent / 人工分工

GPT / Agent：

- 多源数据汇总；
- 阶段候选计算；
- Signal检测；
- 根因候选；
- Constraint识别；
- Strategy生成；
- Action Why解释；
- Validation复盘。

人工：

- 最终目标；
- 高风险动作批准；
- 大预算 / 大幅调价；
- Listing重大修改；
- 多Seller策略；
- 合规申诉；
- 不可逆动作。

---

# 12. V2 验收标准

必须能够：

- 读取 ProductPromotionPlan V2；
- 每天输出 Strategy Context；
- 检测 Signal；
- 对高优先 Signal 运行 Root Cause Tree；
- 输出 Primary Root Cause + Confidence；
- 结合 Stage + Constraint 生成 Action；
- 每个Action包含 Why / Expected Result / Observation Window / Stop Condition；
- 支持 Avoid Actions；
- 支持 Action Cooldown；
- 支持 NO_ACTION / KEEP_OBSERVING；
- 执行动作进入 Validation Queue；
- 验证结果能够推动策略刷新；
- 每天检查阶段升级 / 降级候选；
- 数据不足时明确输出 NEEDS_DATA。