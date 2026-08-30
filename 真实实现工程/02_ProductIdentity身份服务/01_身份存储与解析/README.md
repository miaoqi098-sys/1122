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

### 已纳入 REAL-P2-01
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

## 成熟度

当前：`IMPLEMENTATION_IN_PROGRESS`

只有 GitHub Actions 对 exact head 的 P2 测试全部 PASS 后，本文件夹才可晋级为 `MACHINE_VERIFIED`。
