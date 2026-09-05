# 亚马逊政策边界、APR探索与正向运营方法中心 UI

## 定位

本页面同时承担三件事：

1. `APR`：尽可能广泛发现市场中真实发生的经营技巧、竞争模式、边界玩法与结果模式；
2. `APB`：判断这些现象与 Amazon 官方政策、Expected State / Observed State 的关系；
3. `AOM`：从已知方法与探索结果中筛选可长期使用的正向运营方法。

其中 APR 是重点探索层，AOM 是推荐执行层，APB 是证据与边界层。

## 三类编号

### APR：市场玩法 / 边界模式探索

`APR-{DomainNo}-{Sequence}`

APR 用来记录市场上真实观测到的玩法与结果，不要求其必须属于合规方法才能进入探索库。

APR 前台至少展示：

- 方法/模式名称；
- 想解决的经营目标；
- 观测到的结构；
- 观测到的经营效果；
- 是否重复出现；
- 持续时间 / 是否衰减；
- Policy Relation；
- Business Value Signal；
- Confidence；
- 识别信号；
- 对我方的防御 / 利用价值；
- 可替代的合规方法（如存在）。

APR 的探索主题不因“是否合规”而从观察层排除；但 APR 始终是 `NON_EXECUTABLE_REFERENCE`，不直接产生生产执行权限。

### AOM：正向运营方法

`AOM-{DomainNo}-{Sequence}`

例如：

- `AOM-01-0001` Amazon Vine 新品评价加速
- `AOM-01-0002` Seller Central Request a Review 标准邀评
- `AOM-01-0003` Review主题驱动的产品体验修复循环

AOM 是系统经过政策、经营价值、风险、成本与可持续性筛选后，提供给运营的正式方法。

### APB：政策 / 边界证据

`APB-{DomainNo}-{Type}-{Sequence}`

APB 支撑 APR 和 AOM 的政策关系、边界状态与证据判断。

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
亚马逊经营边界探索中心
├── APR 市场玩法探索【重点】
│   ├── APR编号
│   ├── 经营目标
│   ├── 观测结构
│   ├── 观测效果
│   ├── 重复性 / 持续性
│   ├── Policy Relation
│   ├── Business Value
│   ├── Confidence
│   ├── 对我方影响
│   └── AOM替代方法
│
├── AOM 正向运营方法
│   ├── 方法编号
│   ├── 方法名称
│   ├── 适用商品
│   ├── 适用条件
│   ├── 操作步骤
│   ├── 预期作用
│   ├── 成本
│   └── 衡量指标
│
├── APB 政策 / 边界证据
│
└── 商品 / ASIN 关联视图
```

## 推荐与探索逻辑

```text
市场观察 / 竞品观察 / 自有经营数据
              ↓
             APR
              ↓
效果 / 重复性 / 持续性 / Policy Relation
              ↓
      APB Evidence / Boundary Check
              ↓
     经营价值 × 风险 × 可持续性
              ↓
       AOM 或 Defense Strategy
              ↓
            Agent-1
```

## 权限边界

APR 可以广泛观察和记录，但 UI 与 APR 本身都不拥有生产执行权：

- execution_authorized=false
- amazon_write=false
- ads_write=false
- permission_mutation=false

任何真实执行仍必须进入 Agent-1 → Task → Approval → Permission Boundary。
