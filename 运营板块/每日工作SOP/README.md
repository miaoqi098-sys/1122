# 亚马逊运营每日工作 SOP V1.0

## 1. 定位

每日工作SOP是1122的“日度运营检查与偏差管理层”。

它不是简单的运营日报，也不是要求运营每天机械修改广告，而是每天回答四个问题：

1. 昨天和当前发生了什么？
2. 哪些指标偏离产品推广计划？
3. 哪些异常需要今天处理？
4. 哪些动作需要生成 Decision Item / Task，并在后续验证结果？

核心闭环：

```text
读取当前推广计划
      ↓
读取最新经营事实
      ↓
日度检查
      ↓
异常识别
      ↓
原因初判
      ↓
Decision Item
      ↓
任务中心
      ↓
人工审批 / 执行
      ↓
次日验证
```

---

## 2. SOP原则

### 2.1 先判断，再动作

任何指标异常都必须先区分：

- 数据延迟；
- 正常波动；
- 真实经营异常；
- 外部因素；
- 已知计划内变化。

不得因为单日波动就自动大幅改Bid、价格或Listing。

### 2.2 多窗口判断

默认同时看：

- D1：昨日 / 最新日；
- D3：短期波动；
- D7：主要运营判断；
- D14：趋势确认；
- D30：基线与结构变化。

### 2.3 事实与建议分离

系统输出必须区分：

- `FACT`：真实数据事实；
- `SIGNAL`：规则检测出的信号；
- `DIAGNOSIS`：原因判断；
- `RECOMMENDATION`：建议；
- `APPROVED_ACTION`：已批准动作；
- `EXECUTION_RESULT`：执行结果。

### 2.4 推广计划优先

每日SOP必须读取该ASIN当前的 `ProductPromotionPlan`。

没有推广计划时，可以生成健康检查，但不得假定推广目标。

---

## 3. 每日工作总流程

建议拆成三个阶段：

### A. 数据与风险检查

确认数据是否足够新鲜、关键业务是否存在紧急风险。

### B. 经营诊断与优化

分析销售、流量、广告、关键词、价格、库存、Listing、Review、竞品等。

### C. 日结与任务闭环

把问题转换为优先级明确的任务，并记录次日要验证的结果。

---

# 4. 每日必查模块

## 4.1 数据新鲜度与系统健康

### 输入

- data_source_state；
- Amazon SP-API更新时间；
- Sales & Traffic更新时间；
- Advertising数据更新时间；
- Sif / 关键词数据更新时间；
- D1 / Worker健康状态。

### 检查

- 昨日数据是否完整；
- 是否存在源数据延迟；
- 是否有字段异常为0或null；
- 数据时间范围是否错位；
- marketplace / seller / ASIN是否匹配。

### 输出

- `DATA_READY`
- `DATA_DELAYED`
- `DATA_INCOMPLETE`
- `DATA_CONFLICT`

数据不完整时，相应高风险自动化判断必须降级为“建议人工复核”。

---

## 4.2 销售表现

### 输入

- units；
- orders；
- sales；
- average_selling_price；
- organic_orders；
- ad_orders；
- D1 / D3 / D7 / D14 / D30对比。

### 核心判断

- 昨日销量 vs 7日均值；
- 3日趋势 vs 14日趋势；
- 广告订单是否替代自然订单；
- 客单价变化是否由促销导致；
- 是否偏离推广计划日销目标。

### 默认信号模板

- `SALES_DROP_WARNING`：短期销量显著低于7日基线；
- `SALES_SURGE`：销量显著高于基线，需要检查库存承压；
- `TARGET_MISS`：连续多日低于推广计划目标；
- `ORGANIC_SHARE_DROP`：自然订单占比持续下降。

默认阈值必须产品级可配置，V1不把固定百分比作为永久规则。

---

## 4.3 流量与转化

### 输入

- sessions；
- page_views；
- unit_session_percentage / CVR；
- impressions；
- CTR；
- Buy Box / Featured Offer信号（如可得）。

### 诊断矩阵

| 流量 | CVR | 初步判断 |
|---|---|---|
| ↓ | 稳定 | 曝光 / 排名 / 广告问题 |
| 稳定 | ↓ | Listing / 价格 / Review / 配送 / 竞争问题 |
| ↓ | ↓ | 综合经营异常，优先排查重大变化 |
| ↑ | ↓ | 新增流量质量较差或流量扩张过快 |
| ↑ | ↑ | 放量候选，但必须同步看利润与库存 |

### 输出信号

- `TRAFFIC_DROP`
- `CTR_DROP`
- `CVR_DROP`
- `TRAFFIC_QUALITY_DROP`
- `SCALE_CANDIDATE`

---

## 4.4 广告

每日广告不是“全部调一遍”，而是做异常筛选。

### 输入窗口

- D1：监控预算跑空 / 突发异常；
- D3：短期趋势；
- D7：主要优化窗口；
- D14 / D30：结构判断。

### 必查指标

- Spend；
- Ad Sales；
- Orders；
- ACOS；
- TACOS；
- CPC；
- CTR；
- CVR；
- Budget Utilization；
- Search Terms；
- Placement。

### 每日动作候选

#### 高转化、低曝光

生成：`AD_SCALE_CANDIDATE`

检查：

- 库存是否允许；
- 边际利润是否为正；
- 是否属于核心词；
- 是否已经接近推广计划预算上限。

#### 高花费、无转化

生成：`AD_WASTE_CANDIDATE`

不得仅因单日无单直接否词；结合点击量、D7/D14转化、搜索词相关性判断。

#### Discovery成交词

Phrase / Broad / Auto搜索词达到产品级收割条件时：

生成：`HARVEST_TO_EXACT_CANDIDATE`

#### 重复流量

检测多个Campaign是否对同一高价值词过度竞争，生成：

`AD_OVERLAP_REVIEW`

### 审批

Bid、Budget、Target、Negative、Campaign状态等外部写操作默认 L2。

---

## 4.5 核心关键词与自然排名

### 输入

每个ASIN维护 5–20 个重点词，区分：

- P0 核心成交词；
- P1 增长词；
- P2 长尾词；
- Discovery词。

字段：

- natural_rank；
- sponsored_rank；
- rank_change_d1 / d7 / d14；
- orders；
- CVR；
- ad_coverage；
- target_rank。

### 输出

- `KEYWORD_RANK_GAIN`
- `KEYWORD_RANK_DROP`
- `KEYWORD_TARGET_REACHED`
- `KEYWORD_TARGET_MISS`
- `KEYWORD_INVESTMENT_REVIEW`

排名变化必须结合真实成交和流量，不把单次采样位置当成最终趋势。

---

## 4.6 库存与断货风险

### 输入

- FBA Available；
- Reserved；
- Inbound；
- FC Transfer / Receiving（如可得）；
- 7D / 30D日均销量；
- production lead time；
- shipping lead time；
- receiving buffer；
- 第二Seller库存（如存在）。

### 派生指标

```text
days_of_supply = available_inventory / avg_daily_units

reorder_horizon = production_days + shipping_days + receiving_buffer
```

### 风险等级

产品级可配置，建议默认：

- NORMAL：覆盖明显高于补货周期；
- WATCH：进入补货观察区；
- HIGH：预计断货时间接近补货到仓；
- CRITICAL：预计先断货后到仓。

### 输出

- `REPLENISHMENT_REVIEW`
- `STOCKOUT_RISK`
- `HOLD_SCALE`
- `SECOND_SELLER_HANDOFF_REVIEW`

多Seller同ASIN时必须分别跟踪Seller/FNSKU库存，但在价格、Deal、搜索表现判断中考虑ASIN级影响。

---

## 4.7 价格、参考价与促销

### 必查

- Your Price；
- List Price；
- Was / Typical Price（如可得）；
- Coupon；
- Deal；
- Recent Low Price；
- 其他Seller价格；
- Price Health；
- Featured Offer异常（如可得）。

### 信号

- `PRICE_HEALTH_RISK`
- `REFERENCE_PRICE_RISK`
- `DEAL_PRICE_SPACE_RISK`
- `OTHER_SELLER_LOW_PRICE_ALERT`
- `PROMOTION_ENDING_SOON`

价格策略不能只优化当日转化，还要考虑后续促销空间和利润。

---

## 4.8 Listing健康

### 必查

- Title；
- Bullet Points；
- Main Image；
- A+；
- Variation；
- Browse Node / Category；
- Search Suppressed；
- Buyable；
- Content Version；
- 系统是否发生非计划修改。

### 信号

- `LISTING_SUPPRESSED`
- `LISTING_CONTENT_DRIFT`
- `VARIATION_BREAK`
- `CONTENT_OPTIMIZATION_CANDIDATE`

重大内容调整必须保存版本、日期和变更原因，后续才能判断是否影响CTR/CVR。

---

## 4.9 Review / VOC / 售后

### 必查

- 新增1–3星Review；
- Rating变化；
- Review Count；
- Refund / Return Reason（如可得）；
- Buyer Message；
- 重复VOC主题。

### 输出

- `NEGATIVE_REVIEW_ALERT`
- `VOC_CLUSTER_FOUND`
- `PRODUCT_QUALITY_REVIEW`
- `LISTING_EXPECTATION_MISMATCH`
- `CUSTOMER_SERVICE_TASK`

原则：不得以违规方式诱导、交换利益或要求买家删除/修改评价。

---

## 4.10 竞品

### 每日轻量监控

只跟踪核心竞品，不每天全量爬取所有市场产品。

字段：

- price；
- coupon / deal；
- rating；
- review_count；
- BSR / demand signal；
- listing change；
- ad visibility；
- new variant / bundle。

### 信号

- `COMPETITOR_PRICE_MOVE`
- `COMPETITOR_PROMOTION_MOVE`
- `COMPETITOR_LISTING_UPGRADE`
- `COMPETITOR_NEW_ENTRY`

只有当竞品变化对本产品目标产生实质影响时才转成任务。

---

## 4.11 Account Health / 政策 / Case

### 必查

- Account Health；
- Policy Compliance；
- Listing Removal；
- Restricted Product / Compliance Request；
- FBA异常；
- 未解决Case；
- 影响经营的Amazon通知。

### 风险等级

政策、账户、Listing移除相关问题默认优先级高于普通广告优化。

输出：

- `ACCOUNT_HEALTH_CRITICAL`
- `POLICY_ACTION_REQUIRED`
- `CASE_FOLLOW_UP`
- `FBA_EXCEPTION`

---

# 5. 每日优先级排序

默认使用 P0–P3：

## P0｜立即处理

- 账户 / 政策风险；
- Listing不可售 / Suppressed；
- 严重断货风险；
- 价格健康导致Offer异常；
- 数据系统严重故障导致错误决策风险。

## P1｜当天处理

- 销量 / 转化显著异常；
- 核心广告预算中断；
- 核心关键词明显掉位；
- 大促 / Coupon / Deal临近问题；
- 高价值Case。

## P2｜计划内优化

- 广告搜索词收割；
- Listing优化；
- 竞品响应；
- 新增长词扩展。

## P3｜观察 / 研究

- 尚未形成趋势的信号；
- 创意测试；
- 长期优化建议。

---

# 6. 每日输出：Daily Operating Brief

每日必须产出一份结构化结果，不只是一段总结。

## 6.1 Executive Summary

- overall_status：GREEN / YELLOW / RED；
- today_focus：今天最重要的1–3件事；
- blocked_by：阻塞项。

## 6.2 核心经营指标

- Sales；
- Units；
- Sessions；
- CVR；
- Ad Spend；
- ACOS；
- TACOS；
- Margin；
- Days of Supply。

同时输出与7D / 14D基线的偏差。

## 6.3 Top Signals

最多优先展示 5–10 条真正需要关注的信号，每条包含：

- signal_id；
- severity；
- asin；
- fact；
- diagnosis；
- evidence_window；
- recommended_action；
- approval_level。

## 6.4 今日任务

每条任务包含：

- task_id；
- priority；
- owner；
- due_date；
- source_signal；
- expected_result；
- approval_required；
- status。

## 6.5 昨日动作验证

昨天已执行的任务今天必须检查：

- 是否执行成功；
- 指标是否按预期变化；
- 是否出现副作用；
- 是否需要继续观察；
- 是否应回滚 / 修正。

---

# 7. 每日工作时间逻辑

不把SOP绑定死到具体时钟，但按顺序执行：

### 第一轮：开工检查

1. 数据新鲜度；
2. P0风险；
3. 昨日销量 / 流量 / 转化；
4. 库存与价格；
5. 广告预算与异常。

### 第二轮：深度分析

1. 广告；
2. 关键词；
3. Listing；
4. Review / VOC；
5. 竞品；
6. 推广计划偏差。

### 第三轮：日结

1. 今日完成项；
2. 未完成项；
3. 执行动作记录；
4. 明日验证项；
5. 是否需要更新产品推广计划。

---

# 8. GPT / Agent / 人工分工

## GPT / Agent适合

- 汇总多源数据；
- 对比多时间窗口；
- 异常检测；
- 原因候选分析；
- SOP检查；
- 生成Decision Item；
- 生成任务草案；
- 生成日报；
- 复盘执行结果。

## 人工默认保留

- 最终经营目标；
- 高风险价格动作；
- 大预算调整；
- Listing重大修改；
- 合规 / 账户申诉最终提交；
- 多Seller策略；
- 删除、合并、不可逆操作。

---

# 9. Event → Decision Item → Task

每日SOP检测出的异常不应停留在文字里。

示例：

```text
事实：库存剩余 18 天
补货预计 32 天后可售
        ↓
Event: STOCKOUT_RISK
        ↓
Agent加载：销量、库存、在途、推广计划、广告计划
        ↓
Decision Item:
- HOLD_SCALE
- REDUCE_LOW_PRIORITY_SPEND
- REVIEW_SECOND_SELLER_HANDOFF
        ↓
人工审批
        ↓
Task Center
```

---

# 10. 防止“过度运营”规则

系统必须避免每天频繁改动导致无法归因。

默认原则：

- 单日异常只产生信号，不一定执行；
- 同一对象修改后进入观察期；
- 重大Listing修改后避免同时大幅改价格和广告；
- Bid调整要记录old/new值；
- 每次动作必须有预期结果；
- 次日/后续窗口必须验证；
- 没有足够数据时允许输出 `NO_ACTION / KEEP_OBSERVING`。

“今天没有需要修改”也是合法的运营结论。

---

# 11. V1默认异常阈值设计原则

所有阈值进入产品级配置，不硬编码为全店统一规则。

至少支持：

- sales_drop_pct；
- traffic_drop_pct；
- cvr_drop_pct；
- ctr_drop_pct；
- max_target_acos；
- max_target_tacos；
- no_order_click_threshold；
- harvest_order_threshold；
- keyword_rank_drop_threshold；
- min_days_of_supply；
- critical_days_of_supply；
- rating_warning；
- negative_review_cluster_count。

系统可以提供默认模板，但具体产品由推广计划覆盖。

---

# 12. V1验收标准

每日工作SOP V1必须能够：

- 读取当前推广计划；
- 同时读取D1/D3/D7/D14/D30窗口；
- 检查数据新鲜度；
- 检查销售、流量、广告、关键词、库存、价格、Listing、Review、竞品、账户健康；
- 输出P0–P3优先级；
- 生成结构化Daily Operating Brief；
- 生成Decision Item候选；
- 转换为Task草案；
- 标记审批等级；
- 记录已执行动作；
- 在后续SOP中验证动作结果；
- 数据不足时明确输出UNKNOWN / NEEDS_DATA，而不是猜测。
