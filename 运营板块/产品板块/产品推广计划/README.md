# 产品推广计划 V1.0

## 1. 定位

“产品推广计划”不是单纯的广告计划，而是单 ASIN / 单站点 / 单经营周期的总推广方案。它统一协调：

- 产品阶段与经营目标；
- Listing 与转化基础；
- 关键词与自然排名；
- Amazon Ads；
- 价格、Coupon、Deal 与参考价保护；
- 库存与断货风险；
- Review / VOC；
- 站外推广；
- 竞品变化；
- 利润、TACOS 与现金效率；
- 任务中心中的执行任务。

它回答的核心问题不是“今天广告怎么调”，而是：

> 这个产品现在处于什么阶段、要去哪里、靠哪些杠杆推进、每个阶段用什么指标判断成功、什么情况下暂停/转向、哪些动作必须人工批准。

---

## 2. 作用边界

### 2.1 归属

本模块归属：`运营板块/产品板块/产品推广计划/`

### 2.2 与其他模块关系

```text
产品事实 / 销售 / 流量 / 财务 / 库存 / 广告 / 竞品
                         ↓
                  产品推广计划
                         ↓
              阶段目标 + 策略组合
                         ↓
                   Decision Item
                         ↓
                    任务中心
                         ↓
                  人工审批 / 执行
```

### 2.3 不负责

- 不直接保存真实经营历史，真实事实进入数据板块 / D1；
- 不直接自动修改价格、广告、Listing 或库存；
- 不绕过 Amazon 政策边界；
- 不把“建议”伪装成“已执行”。

---

## 3. 计划主键与粒度

一个计划至少绑定：

- `plan_id`
- `marketplace`
- `seller_scope`
- `asin`
- `sku_scope`
- `start_date`
- `target_end_date`
- `lifecycle_stage`
- `plan_status`

同一 ASIN 可以因不同站点、Seller、阶段拥有多个计划版本，但同一时刻必须有一个明确的“当前主计划”。

---

## 4. 生命周期阶段

### Stage 0｜准备期 PRE_LAUNCH

目标：确认产品具备推广条件，而不是带病投流。

必须检查：

- Listing 完整度；
- 主图 / 标题 / 五点 / A+；
- 核心关键词映射；
- 基础价格与利润空间；
- FBA 可售与在途；
- Review / Vine 状态；
- 竞争强度；
- 合规风险。

退出条件：达到 `launch_readiness = READY`。

### Stage 1｜启动期 LAUNCH

建议默认观察窗口：0–7 天。

核心目标：获得有效曝光、首批订单、建立搜索词与转化基线。

重点：

- Exact 核心词；
- Phrase / Broad Discovery；
- Auto 探索；
- Competitor ASIN；
- Listing CTR / CVR；
- 首批自然词位置；
- 预算是否跑得出去。

### Stage 2｜验证期 VALIDATION

建议默认观察窗口：8–30 天。

核心目标：识别真正能成交、能拉动自然位、能承受利润要求的流量。

重点：

- Search Term → Exact 收割；
- 无效流量清理；
- 核心词自然排名变化；
- 广告订单与自然订单结构；
- CVR 是否达到同类可持续区间；
- 是否存在 Listing / 价格 / Review 短板。

### Stage 3｜增长期 GROWTH

核心目标：在可接受 TACOS / 利润下扩大销量与关键词覆盖。

重点：

- 高转化 Exact 扩量；
- 核心自然词推进；
- SB / SD / Video（具备条件时）；
- Promotion 与价格节奏；
- 库存覆盖天数；
- 竞品份额变化。

### Stage 4｜放量期 SCALE

核心目标：扩大销售规模，同时保护利润、库存和价格历史。

重点：

- 盈利词预算放大；
- 大促 / BD / Prime Event；
- 防断货；
- 参考价保护；
- Seller / Offer 多店策略对同一 ASIN 的价格历史影响；
- TACOS 与边际利润。

### Stage 5｜稳定期 MATURE

核心目标：维持排名、利润和库存健康，减少无效运营波动。

重点：

- 防守核心词；
- 新词增量；
- 竞品监控；
- Listing A/B 测试；
- 促销日历；
- 长期 Review / VOC 改进。

### Stage 6｜清仓/退出 CLEARANCE

核心目标：以库存回收和资金效率为优先，不再以长期排名为唯一目标。

重点：

- 清仓价格边界；
- 广告降本；
- 库存费用；
- 预计售罄日；
- 是否保留 Listing / ASIN 资产。

---

## 5. 输入字段

### 5.1 产品身份

| 字段 | 含义 |
|---|---|
| marketplace | US 等站点 |
| asin | ASIN |
| seller_id / seller_scope | 当前经营 Seller |
| sku / fnsku | SKU 与 FNSKU |
| brand | 品牌 |
| category | 类目 |
| launch_date | 上架日期 |
| lifecycle_stage | 当前阶段 |

### 5.2 经营目标

| 字段 | 含义 |
|---|---|
| target_daily_units | 目标日销 |
| target_monthly_units | 目标月销 |
| target_sales | 目标销售额 |
| target_tacos | 目标 TACOS |
| target_margin | 目标利润率 |
| target_keywords | 重点推进关键词 |
| target_rank | 目标自然位区间 |
| target_review_rating | 评分保护目标 |

### 5.3 销售与流量

至少使用：昨日、3D、7D、14D、30D窗口。

- units / orders / sales；
- sessions / page_views；
- unit_session_percentage；
- organic_orders / ad_orders；
- sales trend 与异常幅度。

### 5.4 广告

- spend；
- ad_sales；
- orders；
- impressions；
- clicks；
- CTR；
- CPC；
- CVR；
- ACOS；
- TACOS；
- campaign / ad_group / target / search_term；
- match_type；
- placement。

### 5.5 关键词

- keyword；
- keyword_type（core / long-tail / competitor / discovery）；
- natural_rank；
- sponsored_rank；
- search_volume / relative_demand；
- clicks / orders / CVR；
- stage_role；
- rank_trend。

### 5.6 库存

- fba_available；
- reserved；
- inbound；
- avg_daily_sales_7d / 30d；
- days_of_supply；
- production_lead_time；
- shipping_lead_time；
- receiving_buffer；
- stockout_risk；
- alternate_seller_inventory（如存在）。

### 5.7 价格与促销

- your_price；
- list_price；
- typical / was price（如可得）；
- coupon；
- deal_price；
- recent_low_price；
- competitor_price；
- price_health；
- promotion_calendar。

### 5.8 利润

- landed_cost；
- fba_fee；
- referral_fee；
- storage_estimate；
- ad_cost；
- promotion_cost；
- contribution_margin；
- contribution_margin_after_ads。

### 5.9 Listing / Review / VOC

- listing_completeness；
- content_version；
- image_version；
- rating；
- review_count；
- recent_negative_review_count；
- top_negative_topics；
- return_reason / refund_reason（如可得）。

### 5.10 竞品

- competitor_asin；
- price；
- coupon / deal；
- rating / review_count；
- BSR / rank signal；
- listing change；
- ad visibility；
- competitive_event。

---

## 6. 计划输出

每次生成或刷新推广计划，必须输出：

1. **Current State**：当前经营状态；
2. **Stage**：生命周期阶段；
3. **Primary Goal**：本周期第一目标；
4. **Secondary Goals**：辅助目标；
5. **Constraints**：库存、利润、价格、政策等约束；
6. **Strategy Mix**：广告 / 关键词 / Listing / 价格 / 促销 / 站外组合；
7. **Key KPI**：阶段关键指标；
8. **Milestones**：阶段里程碑；
9. **Decision Rules**：继续 / 放量 / 收缩 / 暂停 / 转阶段规则；
10. **Recommended Actions**：建议动作；
11. **Approval Required**：是否需要人工批准；
12. **Next Review Date**：下次复盘日期；
13. **Evidence**：每条建议所依据的数据窗口和事实。

---

## 7. 策略组合

### 7.1 广告策略

推荐结构支持：

- Core-Exact；
- Phrase-Discovery；
- Broad-Discovery；
- Auto-Discovery；
- Competitor-ASIN；
- Category / Audience（适用时）；
- SB / SD / Video（适用时）。

原则：Discovery 找词，Exact 承接确定性流量；不得只看单日数据频繁大幅调价。

### 7.2 关键词策略

每个重点词至少维护：

- 当前自然位；
- 目标位；
- 近7/14/30天成交；
- 当前广告覆盖；
- 推进优先级；
- 是否值得继续投入。

### 7.3 Listing策略

CTR问题优先排查：主图、价格、Review、标题展示。

CVR问题优先排查：页面说服力、价格、Review、配送、产品定位、竞品差异。

Listing重大变更必须保存版本和变更日期，避免无法归因。

### 7.4 价格与促销策略

任何主动降价 / Deal / Coupon建议都必须同时检查：

- 毛利；
- 近期最低价；
- 后续Deal空间；
- 同ASIN其他Seller的价格历史影响；
- 清仓 vs 长期经营目标。

### 7.5 库存策略

推广计划不得脱离库存：

- 预计断货早于补货入仓：禁止盲目放量；
- 低库存时优先保护高价值流量与核心词；
- 多Seller同ASIN接力时，库存可独立，但ASIN级价格历史和搜索表现需统一评估。

---

## 8. 决策规则（V1默认模板）

以下规则仅作为系统默认模板，最终阈值必须产品级可配置。

### 放量候选

当满足以下多数条件时，可生成 `SCALE_UP_CANDIDATE`：

- 7D CVR 稳定或改善；
- 目标词已有持续成交；
- ACOS / TACOS 不高于产品容忍区间；
- 库存覆盖足以支撑放量周期；
- Listing / Review 无重大风险；
- 边际利润仍为正。

### 收缩候选

触发 `REDUCE_SPEND_CANDIDATE`：

- 点击持续增长但订单没有同步增长；
- 14D无单高花费词；
- TACOS持续突破警戒线；
- 库存进入高风险；
- 价格或Listing发生未解释变化。

### Listing优化候选

触发 `LISTING_OPTIMIZATION_CANDIDATE`：

- 曝光正常、CTR显著偏低；
- 点击正常、CVR持续恶化；
- 同一VOC问题持续出现；
- 竞品页面发生明显升级且市场反馈增强。

### 暂停放量

触发 `HOLD_SCALE`：

- 预计断货；
- Account Health / Policy风险；
- 价格健康异常；
- Listing被抑制；
- 数据源不新鲜或关键字段缺失。

---

## 9. 审批等级

### L0｜只读

- 数据读取；
- 诊断；
- 计划建议；
- 报告生成。

无需人工批准。

### L1｜低风险执行

例如创建内部任务、更新内部计划状态。可按系统权限自动完成。

### L2｜经营动作

例如：

- 调整广告Bid / Budget；
- 新建/暂停广告Target；
- Coupon / Deal建议；
- Listing内容修改；
- 价格变更。

默认必须进入审批门。

### L3｜高风险动作

例如：

- 大幅价格调整；
- 删除/合并关键资产；
- 影响多个Seller / 多站点；
- 涉及账户、合规、支付或权限。

必须人工明确批准，不允许Agent自行执行。

---

## 10. 推广计划状态机

```text
DRAFT
  ↓
READY_FOR_REVIEW
  ↓
APPROVED
  ↓
ACTIVE
  ├──→ PAUSED
  ├──→ NEEDS_REVISION
  ├──→ STAGE_TRANSITION
  └──→ COMPLETED
```

计划变更必须记录：

- version；
- changed_at；
- changed_by；
- reason；
- evidence_window；
- changed_fields。

---

## 11. 与每日SOP连接

每日工作SOP每天读取当前推广计划，回答：

1. 当前产品目标是什么？
2. 今天是否偏离目标？
3. 哪些指标发生异常？
4. 哪些里程碑达成 / 未达成？
5. 是否需要产生 Event / Decision Item / Task？
6. 是否达到阶段切换条件？

因此每日SOP不是独立报表，而是“推广计划的日度执行与偏差监控层”。

---

## 12. V1验收标准

V1完成必须能够：

- 为任意ASIN建立独立推广计划；
- 明确生命周期阶段；
- 写入目标与约束；
- 关联销售 / 流量 / 广告 / 库存 / 财务 / 关键词事实；
- 输出阶段策略；
- 输出可追溯建议；
- 标记审批等级；
- 生成任务草案；
- 每日SOP能够读取计划并进行偏差检查；
- 不允许在数据不足时伪造结论。
