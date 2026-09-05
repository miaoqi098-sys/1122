# 亚马逊政策边界与正向运营方法中心 UI

## 定位

本页面的最终目的不是给运营看政策条款，而是把 Amazon 政策、真实观测和经营经验转化成**能带来正向经营结果的方法**。

政策边界是约束层；正向运营方法（Positive Operating Method）才是运营层的主要输出。

用户进入页面首先应该看到：

- 现在有什么方法可以帮助增加 Review、提高转化、提高 Featured Offer、提升广告效率、稳定参考价、改善库存周转等；
- 哪些商品现在适用；
- 方法的适用条件、成本、步骤、预期作用和衡量指标；
- Amazon 是否明确允许；
- 有哪些风险边界不能碰；
- 方法依据哪些 Policy Evidence / Boundary Result。

## 两类编号

### 正向运营方法

`AOM-{DomainNo}-{Sequence}`

例如：

- `AOM-01-0001` Amazon Vine 新品评价加速
- `AOM-01-0002` Seller Central Request a Review 标准邀评
- `AOM-01-0003` Review主题驱动的产品体验修复循环

AOM 是运营界面的主要编号。

### 政策/边界证据

`APB-{DomainNo}-{Type}-{Sequence}`

APB 用来支撑方法的合规性和边界判断，不作为运营首页的主要内容。

## 18 个经营域

01 Review 评论与评价
02 Variation 变体
03 Catalog 目录
04 Offer 报价
05 Featured Offer 购物车
06 Pricing 定价与参考价
07 Promotion 促销与活动
08 Advertising 广告
09 Search 搜索与索引
10 BSR 排名
11 Brand 品牌
12 Content Listing与内容
13 Inventory 库存
14 Logistics FBA与物流
15 Returns 退货与退款
16 Account 账户健康
17 Compliance 商品合规
18 Enforcement 违规处置与申诉

## 页面主结构

```text
正向运营方法中心
├── 我现在能做什么
│   ├── 增加 Review
│   ├── 提高转化
│   ├── 提高 Featured Offer
│   ├── 提高广告效率
│   ├── 优化价格/促销
│   ├── 降低退货
│   └── 其他经营目标
│
├── 推荐方法 AOM
│   ├── 方法编号
│   ├── 方法名称
│   ├── 适用商品
│   ├── 适用条件
│   ├── 操作步骤
│   ├── 预期作用
│   ├── 成本
│   ├── 衡量指标
│   ├── Policy Status
│   └── Risk Level
│
├── 对应商品/ASIN
│
├── 政策与边界证据 APB
│
└── 禁止方式 / 红线
```

## Review 示例

运营选择“增加 Review”后，页面应该优先显示：

1. `AOM-01-0001` Amazon Vine
2. `AOM-01-0002` Request a Review
3. `AOM-01-0003` Review主题驱动的产品体验修复循环

而不是要求运营先阅读 Review Policy。

## 推荐逻辑

```text
经营目标
   ↓
商品当前状态
   ↓
筛选可适用 AOM
   ↓
Policy Evidence / Boundary Check
   ↓
成本 × 预期收益 × 风险 × 可逆性
   ↓
推荐方法
   ↓
Agent-1 / TaskDraft
```

## 权限边界

本页面本身只提供事实与方法推荐：

- execution_authorized=false
- amazon_write=false
- ads_write=false
- permission_mutation=false

真实执行仍必须经过 Agent-1 → Task → Approval → Permission Boundary。
