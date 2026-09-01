# 03 快照数据层

用于保存可追溯的经营事实快照。

## 当前已落 D1

- `inventory_snapshots`
- `sales_period_snapshots`
- `traffic_daily`
- `finance_period_snapshots`

## 原则

- 新观察结果优先新增记录，不静默覆盖历史；
- 每条记录必须能追溯 `source + observed_at + parser_version`；
- 同一业务日期允许存在后续修订观测，查询层负责选择“当时值”或“最新修订值”；
- Finance 当前仍标记 `PENDING_VALIDATION`，不得直接解释成利润。

## 后续

- AdsSnapshot
- PricePromotionSnapshot
- Review/VOC Snapshot
- CompetitorSnapshot
- Product-level Sales / Traffic Snapshot
