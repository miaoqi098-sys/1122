# 产品推广计划 V2.0

## 1. 定位

产品推广计划不是广告排期，而是单 ASIN / 单站点 / 单经营周期的“经营战略状态机”。

V2 核心由三个引擎组成：

1. **Stage Engine**：判断产品现在处于什么阶段，以及为什么；
2. **Constraint Engine**：判断当前最大的经营瓶颈是什么；
3. **Strategy Engine**：根据“阶段 + 瓶颈 + 约束”决定应该做什么、不该做什么，以及为什么。

核心链路：

```text
真实经营事实
  ↓
Stage Engine
  ↓
Current Stage + Confidence + Why
  ↓
Constraint Engine
  ↓
Primary Constraint + Secondary Constraints
  ↓
Strategy Engine
  ↓
Recommended Actions + Avoid Actions + Why
  ↓
Decision Item
  ↓
审批 / Task / 执行
  ↓
Validation
  ↓
计划刷新 / 阶段切换
```

---

## 2. 经营阶段不是“上架天数”

阶段由四类因素共同决定：

- 时间与样本量；
- 经营成熟度；
- 阶段目标完成度；
- 风险与约束状态。

同样上架 20 天，一个 ASIN 可能已进入 GROWTH，另一个仍停留在 VALIDATION。

系统必须输出：

- `current_stage`
- `stage_confidence`
- `stage_since`
- `stage_reason`
- `stage_evidence`
- `transition_candidate`
- `regression_candidate`

---

# 3. Stage Engine

## 3.1 阶段定义

### PRE_LAUNCH｜准备期

主要矛盾：是否具备开始推广的条件。

必须检查：

- Listing 是否完整；
- 主图 / 标题 / 五点 / A+ 是否达到最低标准；
- 核心关键词映射是否建立；
- 价格、成本、FBA Fee、利润底线是否明确；
- FBA 可售 / 在途是否可支撑启动；
- Review / Vine 状态；
- 合规、类目、变体、Buyable 是否正常。

进入 LAUNCH 的条件不是“到了某一天”，而是：

```text
launch_readiness = READY
AND listing_health = READY
AND inventory_ready = true
AND pricing_ready = true
AND policy_block = false
```

---

### LAUNCH｜启动期

主要矛盾：是否能够建立首批有效曝光、点击、订单与搜索词样本。

重点判断：

- 是否有真实曝光；
- CTR 是否形成初步基线；
- 是否有真实点击；
- 是否有首批订单；
- 是否开始产生 Search Term；
- 广告预算是否能够正常消耗；
- 是否出现明显 Listing / 价格 / Review 阻塞。

进入 VALIDATION 的最低条件：

```text
minimum_sample_reached = true
AND impressions > minimum_impressions
AND clicks > minimum_clicks
AND orders > 0
AND search_term_sample_available = true
```

---

### VALIDATION｜验证期

主要矛盾：流量是否真的能成交，且是否找到可复制的流量来源。

重点判断：

- CVR 是否达到产品最低可持续区间；
- Search Term 是否出现重复成交；
- Exact / Phrase / Broad / Auto 中是否形成有效流量；
- 核心词是否开始出现自然位改善；
- 广告订单与自然订单结构；
- Listing / 价格 / Review 是否仍是主要短板；
- TACOS / 边际利润是否具备继续投入空间。

进入 GROWTH 候选：

```text
conversion_validated = true
AND repeatable_traffic_found = true
AND listing_major_blocker = false
AND inventory_supports_growth = true
AND policy_block = false
```

如果长期无法验证，应允许：

```text
VALIDATION → REVALIDATION / PAUSED / CLEARANCE
```

---

### GROWTH｜增长期

主要矛盾：如何把已验证的成交模型扩大，同时推进自然排名。

典型特征：

- CVR 已达到可接受区间；
- 有一批稳定成交词；
- 有明确的 P0/P1 关键词；
- 广告结构已有可复制单元；
- 核心词自然位持续改善；
- TACOS / Margin 尚未进入危险区；
- 库存足够支撑增长。

进入 SCALE 候选：

```text
sales_growth_sustained = true
AND target_keyword_momentum = positive
AND tacos_within_tolerance = true
AND contribution_margin_after_ads > 0
AND inventory_buffer_sufficient = true
AND review_health = healthy
AND price_health = healthy
AND policy_block = false
```

---

### SCALE｜放量期

主要矛盾：扩大规模，同时保护利润、库存与价格历史。

重点：

- 盈利词放大；
- 高价值词预算保护；
- SB / SD / Video / Category / Audience；
- Deal / Coupon / Prime Event；
- 防断货；
- 参考价与近期低价保护；
- 多 Seller 同 ASIN 的库存与价格影响；
- 边际利润。

当增长失速、利润失控或库存不足时，可退回 GROWTH。

---

### MATURE｜稳定期

主要矛盾：维持自然优势、利润与库存健康，同时寻找增量。

重点：

- 防守核心词；
- 新词增量；
- Listing A/B；
- Promotion Calendar；
- Review / VOC；
- 竞品变化；
- 长期利润与现金效率。

当核心词、CVR、竞争力发生结构性恶化时：

```text
MATURE → REVALIDATION
```

---

### REVALIDATION｜重新验证

用于老品或成熟品出现结构性变化时重新验证。

典型触发：

- 核心词持续大幅掉位；
- CVR 持续下降；
- 大幅调价；
- Listing 重大改版；
- 产品升级 / 包装升级；
- 竞品重大升级；
- 市场需求结构变化；
- Review / VOC 出现新问题。

退出 REVALIDATION 后可返回 GROWTH / MATURE，或进入 CLEARANCE。

---

### CLEARANCE｜清仓/退出

主要矛盾：库存回收与现金效率，而不是长期排名。

重点：

- 售罄速度；
- 库存费；
- 广告降本；
- 可接受最低价格；
- 是否保留 ASIN 资产；
- 清仓后是否退出。

---

# 4. Stage Engine 输出

每次阶段判定必须输出：

```text
Current Stage
Stage Confidence
Stage Since
Primary Reason
Supporting Evidence
Missing Evidence
Transition Candidate
Regression Candidate
```

禁止仅输出“阶段=GROWTH”而不给原因。

---

# 5. Constraint Engine

## 5.1 目标

在当前阶段下识别“第一主要矛盾”。

支持的 V2 瓶颈类型：

- `TRAFFIC_CONSTRAINT`
- `CTR_CONSTRAINT`
- `CONVERSION_CONSTRAINT`
- `AD_EFFICIENCY_CONSTRAINT`
- `KEYWORD_RANK_CONSTRAINT`
- `PRICE_CONSTRAINT`
- `REVIEW_CONSTRAINT`
- `LISTING_CONSTRAINT`
- `INVENTORY_CONSTRAINT`
- `PROFIT_CONSTRAINT`
- `COMPETITIVE_CONSTRAINT`
- `POLICY_CONSTRAINT`
- `DATA_CONSTRAINT`
- `NO_MAJOR_CONSTRAINT`

必须区分：

- `primary_constraint`
- `secondary_constraints`
- `constraint_confidence`
- `constraint_evidence`

## 5.2 基础诊断矩阵

| 现象 | 优先瓶颈判断 |
|---|---|
| Sessions↓、CVR稳定 | Traffic / Rank / Ads |
| Sessions稳定、CVR↓ | Conversion / Price / Review / Listing |
| Sessions↑、CVR↓ | Traffic Quality |
| CTR↓、CVR稳定 | Main Image / Price / Rating / SERP竞争 |
| CVR高、自然位弱 | Keyword Rank / Exposure |
| 销量好、库存不足 | Inventory |
| 销量增长但TACOS恶化 | Ad Efficiency / Profit |
| 数据不新鲜 | Data Constraint |

Constraint Engine 不直接下结论，必须附带证据和置信度。

---

# 6. Strategy Engine

Strategy Engine 输入：

```text
Stage
+
Primary Constraint
+
Secondary Constraints
+
Goals
+
Constraints
+
Current Facts
```

输出：

```text
Primary Strategy
Recommended Actions
Avoid Actions
Why
Expected Result
Observation Window
Stop Condition
Approval Level
```

## 6.1 示例：VALIDATION + CONVERSION_CONSTRAINT

应该优先：

- 检查主图 / 标题 / 价格 / Rating；
- 检查高流量低转化 Search Term；
- 检查竞品 Offer / Coupon / Review；
- 优化详情页说服力；
- 过滤明显低相关流量。

不应该优先：

- 大幅扩大 Broad；
- 直接大幅加预算；
- 同时改价格 + Listing + 广告导致无法归因。

原因：

> 流量已经存在，扩大流量不能解决转化问题，只会扩大低效流量。

---

## 6.2 示例：GROWTH + KEYWORD_RANK_CONSTRAINT

应该优先：

- P0 Exact 保障曝光；
- 收割高转化 Discovery Search Term；
- 核心词预算与Placement优化；
- 保持已验证的价格与Listing稳定。

不应该优先：

- 无原因大改主图；
- 大范围扩展低相关Broad；
- 同时启动多项大改动。

---

## 6.3 示例：GROWTH + INVENTORY_CONSTRAINT

应该：

- `HOLD_SCALE`
- 保护 P0 核心词；
- 降低 P2 / Discovery 消耗；
- 评估补货与第二 Seller 接力；
- 检查在途与收货时间。

不应该：

- 大幅加预算；
- 发起大促；
- 用低价强行放量。

---

# 7. 动作必须带 Why

所有动作强制包含：

- `action_type`
- `action`
- `why`
- `evidence`
- `expected_result`
- `observation_window`
- `stop_condition`
- `avoid_if`
- `approval_level`

没有 `why` 和 `evidence` 的动作不得进入 Task Center。

---

# 8. 系统必须输出“为什么不做”

允许动作：

```text
NO_ACTION
KEEP_OBSERVING
HOLD_SCALE
DO_NOT_CHANGE_LISTING
DO_NOT_CHANGE_PRICE
DO_NOT_EXPAND_TRAFFIC
```

“今天不改”是合法结论。

---

# 9. 阶段切换与倒退

任何阶段切换都必须：

1. 满足最小样本；
2. 满足转阶段条件；
3. 没有更高优先级阻塞项；
4. 输出支持证据；
5. 记录 `from_stage / to_stage / reason / evidence / confidence`。

允许：

```text
LAUNCH → VALIDATION
VALIDATION → GROWTH
GROWTH → SCALE
SCALE → MATURE
MATURE → REVALIDATION
SCALE → GROWTH
GROWTH → VALIDATION
ANY → CLEARANCE
```

---

# 10. 核心输入

沿用 V1 的销售、流量、广告、关键词、库存、价格、利润、Listing、Review、竞品等输入，并增加：

- `stage_assessment`
- `constraint_assessment`
- `strategy_assessment`
- `sample_sufficiency`
- `data_freshness`
- `change_history`
- `action_cooldown`
- `stage_transition_history`

---

# 11. 推广计划输出

每次计划刷新必须输出：

1. Current State
2. Current Stage
3. Stage Confidence
4. Why This Stage
5. Primary Constraint
6. Why This Constraint
7. Primary Goal
8. Constraints
9. Strategy
10. Recommended Actions
11. Avoid Actions
12. Why These Actions
13. Expected Results
14. Observation Windows
15. Stop Conditions
16. Milestones
17. Transition Candidate
18. Approval Required
19. Next Review Date
20. Evidence

---

# 12. 审批等级

- L0：只读、诊断、计划；
- L1：内部状态与任务创建；
- L2：Bid / Budget / Target / Coupon / Listing / Price 等经营动作；
- L3：多Seller、多站点、合规、删除、合并、不可逆动作。

---

# 13. 与每日SOP连接

产品推广计划负责：

```text
我现在在哪里？
为什么？
当前最大瓶颈是什么？
本阶段核心目标是什么？
应该采取什么策略？
哪些动作暂时不该做？
```

每日SOP负责：

```text
昨天发生了什么？
是否偏离计划？
是否出现新瓶颈？
今天应该做哪个动作？
为什么？
昨天动作有没有达到预期？
```

---

# 14. V2 验收标准

V2 必须能够：

- 自动计算阶段候选，而不是仅人工填写；
- 输出阶段置信度与原因；
- 自动识别 Primary Constraint；
- 根据 Stage + Constraint 生成 Strategy；
- 每个动作输出 Why / Evidence / Expected Result；
- 输出 Avoid Actions；
- 支持阶段升级、降级、REVALIDATION；
- 支持 NO_ACTION / KEEP_OBSERVING；
- 数据不足时输出 UNKNOWN / NEEDS_DATA；
- 任何外部写动作继续遵守审批门。