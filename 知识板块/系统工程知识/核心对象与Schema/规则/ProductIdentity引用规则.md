# ProductIdentity 引用规则 V1

## 1. 核心定位

`ProductIdentity` 是全系统用于回答“这些数据、事件、任务、操作和记忆究竟属于哪一个经营产品”的统一身份锚点。

它解决的不是商品标题或 Listing 内容，而是跨模块稳定关联。

## 2. Canonical主键

统一使用：

`product_id`

作为系统内部跨模块主引用。

以下外部字段不得被当作全系统唯一主键：
- ASIN；
- SKU；
- FNSKU；
- Parent ASIN；
- 产品标题；
- Campaign ID。

原因：
- ASIN 的语义依赖 Marketplace；
- SKU 的语义依赖 Seller Account + Marketplace；
- 同一经营实体在不同系统中可能存在多个外部标识；
- 产品标题会变化；
- Parent/Child 关系会变化。

## 3. product_id稳定性

`product_id` 创建后默认不可变。

以下变化不得导致 product_id 自动变化：
- 标题变化；
- 图片变化；
- 价格变化；
- 库存变化；
- 广告变化；
- 父子体调整；
- FNSKU变化；
- 经营阶段变化。

如果 Seller Account 或 Marketplace 发生本质迁移，默认创建新的 ProductIdentity，再通过迁移/关联记录建立历史关系；不得静默改写旧身份。

## 4. 外部唯一性语义

### ASIN
推荐判断键：

`marketplace_id + asin`

它用于识别 Amazon Catalog 商品，不代表卖家经营实例本身。

### SKU
推荐判断键：

`seller_account_id + marketplace_id + sku`

它用于识别卖家在指定站点下的 Seller SKU。

### 系统经营产品

统一使用：

`product_id`

## 5. 变体关系

`parent_asin` 只保存 Amazon 外部父 ASIN。

若父体也作为系统对象存在，应额外使用：

`parent_product_id`

引用父体内部主键。

同一变体族使用：

`variation_family_id`

进行系统内部聚合。

不得使用 `parent_asin` 代替 `variation_family_id`，因为 Amazon 父子结构可能调整。

## 6. 下游对象引用要求

以下系统对象未来必须能够回指 `product_id`（单品对象直接引用，多产品对象使用 product_refs）：
- MetricSnapshot；
- BusinessState；
- ProductStage；
- Goal；
- Event；
- DecisionItem；
- FinalDecision；
- TaskPlan / Task；
- Approval / HumanActionRequest；
- Action；
- ExecutionResult；
- ValidationResult；
- AgentActivity；
- Memory / StageSummary；
- CampaignLink；
- CompetitorLink。

## 7. UI规则

首页和产品状态卡可以展示 ASIN、SKU、产品名称，但页面路由和后台查询应优先携带 `product_id`。

推荐：

```text
/products/{product_id}
```

而不是把 ASIN 作为唯一内部路由主键。

## 8. 数据导入/匹配规则

导入外部数据时：
1. 优先通过已有外部映射查找 product_id；
2. SKU 数据按 seller_account_id + marketplace_id + sku 匹配；
3. ASIN 数据按 marketplace_id + asin 匹配；
4. 多候选或冲突时不得自动随意归并；
5. 无法唯一识别时进入 IdentityResolution 待处理流程（该流程后续建设）。

## 9. 冲突保护

以下情况必须视为身份冲突：
- 同一 seller_account_id + marketplace_id + sku 映射到多个 active product_id；
- 同一 product_id 同时绑定互相矛盾的 seller_account_id / marketplace_id；
- 外部数据无法确定属于哪个 product_id，却被强制写入经营历史；
- 把 parent_asin 当作内部父对象引用导致错误关联。

身份冲突未解决前，相关经营数据允许进入隔离/待匹配状态，但不得污染正式产品时间线。

## 10. 当前边界

本规则只定义静态身份 Contract。

暂不实现：
- ProductIdentity 数据库；
- 自动 IdentityResolution 服务；
- Amazon API 实时映射；
- 历史迁移程序。
