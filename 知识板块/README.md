# 知识板块

知识板块保存系统可以反复复用的认知、规则、方法、定义、案例结论与工程知识。

知识回答“系统普遍知道什么”；记忆回答“某个具体产品、任务或决策过去发生过什么”。

## 一、知识库目标

知识库不是 Markdown 文档仓库，而是 1122 的可检索认知层。它必须支持：

- Agent 在决策前检索相关知识；
- 运营人员按目标、产品、ASIN、领域检索可用方法；
- 政策、运营方法、市场玩法、案例经验统一引用；
- 同一知识保留版本、来源、置信度、真值等级和验证时间；
- 新证据出现后可以升级、降级、冲突标记或废弃旧版本；
- 所有知识默认只读，不直接获得 Amazon / Ads 生产执行权限。

## 二、统一知识对象

统一对象：`KnowledgeItem`

ID：`KB-{TYPE}-{SEQUENCE}`

示例：

- `KB-POL-0001` Review 政策知识
- `KB-OPS-0001` Review 增长运营方法
- `KB-MKT-0001` 市场玩法观察
- `KB-ADS-0001` 广告结构知识
- `KB-PRI-0001` 定价知识
- `KB-CAS-0001` 经营案例复盘
- `KB-SYS-0001` 系统工程知识
- `KB-DAT-0001` 数据定义
- `KB-DEC-0001` 决策规则

Schema：`KnowledgeItem.schema.json`

分类表：`KnowledgeTaxonomy.v1.json`

## 三、知识类型

1. `POLICY` 政策知识
2. `OPERATING_METHOD` 运营方法
3. `MARKET_PATTERN` 市场玩法与边界模式
4. `PRODUCT_KNOWLEDGE` 产品经营知识
5. `ADVERTISING_KNOWLEDGE` 广告知识
6. `PRICING_KNOWLEDGE` 价格与促销知识
7. `CONTENT_KNOWLEDGE` Listing 与内容知识
8. `CASE_LESSON` 案例复盘知识
9. `SYSTEM_ENGINEERING` 系统工程知识
10. `DATA_DEFINITION` 数据定义
11. `DECISION_RULE` 决策规则

## 四、真值等级

```text
SOURCE_ONLY
    ↓
OBSERVED
    ↓
DERIVED
    ↓
VALIDATED
    ↓
CONFIRMED
```

旁路状态：

- `CONFLICTING`
- `UNKNOWN`

不能因为某个方法“市场上有人做”就升级为有效知识，也不能因为技术上可行就判定政策允许。

## 五、知识来源

知识可以由以下来源进入：

```text
Amazon官方政策/APB
        ↓
AOM正向运营方法
        ↓
APR市场玩法观察
        ↓
我方产品真实经营数据
        ↓
Agent分析结果
        ↓
Sandbox验证
        ↓
真实小流量结果
        ↓
案例复盘
        ↓
KnowledgeItem
```

原始来源不得被知识摘要替代。KnowledgeItem 必须保留 `source_refs` / `source_urls`。

## 六、知识与其他板块关系

```text
数据板块 = 发生了什么
记忆板块 = 某个对象过去发生过什么
知识板块 = 从数据、政策、案例中沉淀出的可复用认知
Agent板块 = 使用知识形成判断
沙盘板块 = 验证知识/方法在假设场景中的效果
任务中心 = 承接决策后的受控行动
```

知识库不拥有 Executor 权限。

## 七、检索方向

V1 首先支持：

- keyword / title / content 搜索
- knowledge_type
- domain
- marketplace
- truth_class
- confidence
- status
- related product refs

后续增加：

- embedding / semantic retrieval
- product-state-aware retrieval
- Agent retrieval context builder
- evidence graph
- knowledge conflict resolution
- knowledge aging / freshness scoring

## 八、安全边界

固定规则：

```text
Knowledge != Permission
Knowledge != Policy Allowed
Observed != Confirmed
Technically Possible != Sustainable
```

所有 V1 知识对象：

- `execution_authorized=false`
- `production_write_authorized=false`

生产执行仍必须经过 Agent-1 → Task → Approval → Permission Boundary。
