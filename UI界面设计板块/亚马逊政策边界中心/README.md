# 亚马逊政策边界中心 UI

## 定位

本页面是 1122 `亚马逊政策边界/` 的正式 UI 展示入口。UI 只消费政策边界板块产出的结构化结果，不在前端自行判断 Amazon 政策，也不直接生成执行权限。

## 一级页面目标

用户进入后应立即回答：

1. Amazon 18 个政策域当前覆盖到什么程度；
2. 最近哪些官方政策发生变化；
3. 哪些 Expected State 与 Observed State 出现差异；
4. 哪些差异只是 Observation，哪些已经成为 Signal / Candidate / Confirmed Result；
5. 哪些边界结果影响到我方商品、ASIN、广告、价格、促销、账户或合规；
6. 每一项结论的官方证据、Marketplace、版本、更新时间和置信度是什么。

## 固定分类编号

页面按 `APB-01` 至 `APB-18` 排列：

01 评论与评价 Review
02 变体 Variation
03 目录 Catalog
04 报价与 Offer
05 Featured Offer
06 定价与参考价 Pricing
07 促销与活动 Promotion
08 广告政策 Advertising
09 搜索与索引 Search
10 BSR 与排名
11 品牌 Brand
12 Listing 与内容 Content
13 库存 Inventory
14 FBA 与物流 Logistics
15 退货与退款 Returns
16 账户健康 Account
17 商品合规 Compliance
18 违规处置与申诉 Enforcement

## 结果编号

每条结果统一使用：

`APB-{DomainNo}-{Type}-{Sequence}`

Type：

- PE = Policy Evidence
- PD = Policy Diff
- BS = Boundary Signal
- BC = Boundary Candidate
- BR = Confirmed Boundary Result
- PI = Product Impact

示例：`APB-06-PD-0001` 表示 Pricing 域第一条 Policy Diff。

## 页面结构

```text
亚马逊政策边界中心
├── 顶部总览
│   ├── 18域覆盖率
│   ├── VERIFIED数量
│   ├── CONFLICT数量
│   ├── 新Policy Diff
│   ├── Boundary Signal
│   └── Confirmed Result
│
├── 18域分类导航 APB-01 ~ APB-18
│
├── 政策变化流 Policy Change
│
├── 边界探索结果表
│   ├── 编号
│   ├── 分类
│   ├── Marketplace
│   ├── 结果类型
│   ├── 状态
│   ├── 标题/结果摘要
│   ├── Expected State
│   ├── Observed State
│   ├── Confidence
│   ├── 影响商品数
│   ├── 最后验证时间
│   └── 证据入口
│
├── 商品影响视图
│   └── Product/ASIN → 关联 APB 结果
│
└── 详情抽屉
    ├── 官方政策证据
    ├── Policy Diff
    ├── 重复观测
    ├── Alternative Explanation Review
    ├── 四分法状态
    └── Agent-12 / Sandbox / Decision 引用
```

## 固定状态展示

覆盖状态：`DISCOVERY / SEEDED / VERIFIED / CONFLICT / UNKNOWN`

边界生命周期：`OBSERVATION / NEEDS_RECHECK / SIGNAL / CANDIDATE / CONFIRMED / SUPERSEDED`

Confidence：`HIGH / MEDIUM / LOW / UNVERIFIED`

UI 不得把 DISCOVERY/SEEDED 显示成“政策已确认”。

## 商品级联动

当 BoundaryResultCase 包含 `affected_product_refs` 时：

- 在本中心显示受影响商品；
- 在对应产品状态卡显示“Amazon政策/边界影响”摘要；
- CONFIRMED 或高风险 CONFLICT 可进入首页“重点异常与机会”；
- 需要人工处理的政策冲突/合规事项才可进入“今日需要我处理”。

## 权限边界

本 UI 永远只读展示政策边界事实：

- execution_authorized=false
- amazon_write=false
- ads_write=false
- permission_mutation=false

任何真实动作必须继续进入 Agent-1 → Task → Approval → Permission Boundary。
