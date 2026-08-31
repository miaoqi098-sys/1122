# Agent-4｜广告实体与结构模型

## 1. 核心层级
统一广告实体：
`portfolio → campaign → ad_group → ad / target → search_term`

其中search_term是实际用户查询/触发结果，不等于target。target可能为关键词、商品、类目、受众或自动投放规则。

## 2. 三类广告
SP、SB、SD共用核心实体语义，但允许保留各自特有字段。任何分析必须带ad_type，禁止跨广告类型直接机械比较。

## 3. Target与Search Term
- target：卖家/系统配置的投放对象；
- search_term：实际触发或产生流量的用户查询/展示对象；
- 一个target可对应多个search_term；
- 同一search_term可能由多个target承接；
- 否定操作作用对象与匹配方式必须显式记录。

## 4. 匹配方式
关键词Target至少区分broad/phrase/exact；自动、商品、类目、受众等使用独立类型。不得把“搜索词精确匹配表现”直接等同于“现有Exact Target表现”。

## 5. 结构诊断
结构问题包括：
- 多个活动重复承接同一核心搜索词；
- 不同ASIN/变体混在同组导致无法归因；
- 广告目标混杂，预算与目标冲突；
- 自动/广泛发现流量没有向可控Target迁移；
- 否定规则误伤；
- campaign/ad_group粒度不足以支持预算或竞价控制。

## 6. Scope
每个广告实体必须能关联到商品/父体/SKU/品牌等经营scope。广告实体本身不是最终经营scope，Agent-1仍需结合产品目标判断。

## 7. 正式Schema
见 `AdvertisingEntity.schema.json`。