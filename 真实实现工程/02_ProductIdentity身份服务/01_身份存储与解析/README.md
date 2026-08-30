# REAL-P2-01｜ProductIdentity 身份存储与解析

## 目标

把已验收的 `ProductIdentity` Canonical Contract 从静态 Schema 落实为真实可调用的 Python 服务能力。

本文件夹只负责身份模型、身份存储、身份解析和统一调用门面，不提前承担 Amazon Connector、MetricSnapshot、状态识别或 UI 职责。

## Canonical 约束

- 全系统稳定内部主键：`product_id`；
- ASIN、SKU、FNSKU、Parent ASIN 均不得成为跨模块系统主键；
- SKU 唯一语境：`seller_account_id + marketplace_id + sku`；
- ASIN 目录语境：`marketplace_id + asin`，可能对应多个卖家经营实例，因此允许返回 ambiguous；
- `product_id` 创建后不可因标题、价格、库存、广告、父子体或 FNSKU 变化而自动改变；
- 多候选、矛盾映射必须 fail closed，不得随意归并。

Canonical 来源：
- `系统总工程蓝图/核心对象与Schema/schemas/ProductIdentity.schema.json`
- `系统总工程蓝图/核心对象与Schema/规则/ProductIdentity引用规则.md`

## 当前实现边界

### 已实现
- Pydantic ProductIdentity Model；
- InMemoryProductIdentityStore；
- product_id / SKU / ASIN 索引；
- active SKU 冲突保护；
- IdentityResolver；
- ResolutionResult；
- ProductIdentityService；
- pytest；
- GitHub Actions 机器门禁。

### 暂不实现
- PostgreSQL / ORM；
- Amazon SP-API 实时映射；
- 数据迁移程序；
- 自动合并冲突身份；
- Amazon / Ads 写操作；
- UI API。

数据库持久化会在后续确有运行需求时再选型；当前用内存 Store 固化接口和行为，避免 P2 过早绑定数据库实现。

## 目录

```text
01_身份存储与解析/
├── README.md
├── pyproject.toml
├── src/
│   └── product_identity/
│       ├── __init__.py
│       ├── models.py
│       ├── store.py
│       ├── resolver.py
│       └── service.py
├── tests/
│   ├── test_models.py
│   ├── test_store.py
│   └── test_resolver.py
└── L1验收.md
```

## 机器验收

- workflow：`real-v1-p2-ci`
- run：`33302190845`
- job：`p2-product-identity-tests`
- implementation head：`b94fa82a943099fab0a5d3a66203585fa6897e81`
- 结果：`16 passed in 0.11s`
- conclusion：`success`
- 同一 implementation head 的 P1 回归：`success`

## 成熟度

当前：`MACHINE_VERIFIED`

L1记录：`L1验收.md`

下一阶段允许进入 P3 Amazon 只读 Connector，但 P2 的机器通过不代表已取得真实 Amazon 授权、真实读取或持久化数据库能力。
