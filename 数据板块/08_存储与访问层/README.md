# 08 存储与访问层

## 正式存储职责

### KV — HOT / Current State Cache
用于：
- 当前 ProductIdentity 聚合状态；
- 当前 InventorySnapshot；
- 当前 Sales / Traffic / Finance 状态；
- 驾驶舱快速读取缓存。

不用于：
- 永久历史；
- 大量时间序列；
- 复杂关系查询。

### D1 — WARM / Core Operating Facts
数据库：`1122-core`

用于：
- ProductIdentity 主数据；
- 每日经营事实；
- 历史库存/销售/流量/财务；
- ProductOperatingPlan；
- Stage / Goal / Action；
- Event / Decision / Task / Validation；
- 原始档案索引。

### R2 — COLD / Permanent Archive
Bucket：`1122-data-archive`

用于：
- Amazon 原始 Report；
- Sif 原始响应；
- Ads 原始报告；
- 大型 JSON；
- 后续 Parquet；
- D1 导出备份。

R2 Bucket 保持 Private，不开启公开 r2.dev URL。

## 访问边界

```text
Browser
  ↓
Authenticated API / Worker
  ↓
Query Service
  ├── KV
  ├── D1
  └── R2
```

浏览器禁止直接持有 D1/R2/第三方长期凭据。

## 长期方向

- UI 常用当前状态：KV；
- 7/30/90天和生命周期查询：D1；
- 大范围原始重算/多年明细：R2；
- 大规模历史分析：R2 Parquet + SQL/分析引擎。
