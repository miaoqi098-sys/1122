# 01 数据模型与契约

本目录只保存 Canonical Model（规范数据模型）和接口契约，不保存真实经营数据。

## 第一批模型

- ProductIdentity
- InventorySnapshot
- SalesSnapshot
- TrafficSnapshot
- FinanceSnapshot
- ProductOperatingPlan
- ProductDailyState
- ProductEvent
- FinalDecision
- Task
- ValidationResult
- RawArchiveManifest

## 通用字段

所有长期数据对象原则上包含：

```text
schema
schema_version
source
marketplace
product_id（产品级对象）
observed_at
created_at
freshness
```

## 版本规则

- 破坏性结构变化：升级 major version；
- 新增兼容字段：升级 minor version；
- 数据解析修复：记录 parser_version；
- 不允许静默改变历史字段语义。
