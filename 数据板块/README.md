# 数据板块

1122 的系统级 Data Layer（数据层）。

## 定位

数据板块不是运营板块的子目录，而是全系统公共基础设施。运营 UI、Agent、A1、任务中心、沙盘、知识和后续分析统一从这里读取同一套经营事实。

## 三层存储

```text
HOT   KV   → 当前状态 / 驾驶舱缓存
WARM  D1   → 可查询的长期经营事实
COLD  R2   → 原始报告 / JSON / Parquet / 数据库导出档案
```

正式资源：

- D1：`1122-core`
- R2：`1122-data-archive`
- KV：沿用 `PRODUCT_STATE`，逐步泛化为 Current State Cache（当前状态缓存）

## 核心规则

1. UI 不是数据源；
2. Git 不保存真实经营数据；
3. D1 中的历史事实默认 Append Only（只新增），修正必须保留修正记录；
4. R2 原始档案原则上不静默删除；
5. KV 允许覆盖，因为它只是当前状态缓存；
6. D1 丢失时应能从 R2 原始档案和事件重建关键经营数据；
7. KV 丢失时应能从 D1 重建当前状态；
8. 所有数据必须带来源、观察时间、schema/version 和 freshness；
9. ProductIdentity 是产品经营数据的稳定关联主键；
10. Secret / Token 只进入 Secret Manager，不属于数据层业务表。

## 目录

```text
数据板块/
├── 01_数据模型与契约/
├── 02_主数据层/
├── 03_快照数据层/
├── 04_运营计划数据层/
├── 05_事件与时间线/
├── 06_指标与派生数据/
├── 07_数据质量与新鲜度/
├── 08_存储与访问层/
├── 09_数据库迁移与版本/
└── 10_备份与恢复/
```

## 第一阶段

Data Layer V1 首批正式对象：

- ProductIdentity
- InventorySnapshot
- SalesSnapshot
- TrafficSnapshot
- FinanceSnapshot
- ProductOperatingPlan
- ProductDailyState
- Event
- FinalDecision
- Task
- ValidationResult
- RawArchiveManifest

## 数据流

```text
Amazon / Ads / Sif / Internal
            ↓
       Connector Layer
            ↓
       Normalize / Validate
            ↓
 ┌──────────┼──────────┐
 ↓          ↓          ↓
R2         D1          KV
RAW        FACTS       CURRENT
 ↓          ↓          ↓
Archive   Query       Fast UI
            ↓
     Agent / A1 / Task / UI
```
