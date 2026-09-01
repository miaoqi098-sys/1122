# SalesSnapshot.v1

## 目标

将 Amazon Sales API（销售指标接口）的聚合经营数据标准化为 1122 的销售快照，用于点亮运营驾驶舱的销售额、订单量，并为后续库存覆盖天数提供销售速度基础。

## 数据源

Amazon Selling Partner API for Sales：

`GET /sales/v1/orderMetrics`

当前第一阶段只读取聚合指标，不读取订单级买家信息，不接触姓名、地址、电话等 PII（个人信息）。

## Canonical Object（规范对象）

```text
SalesSnapshot
├── schema
├── marketplace
├── marketplace_id
├── observed_at
├── source
└── ranges
    ├── today
    │   ├── interval
    │   ├── total_sales
    │   ├── currency
    │   ├── order_count
    │   ├── order_item_count
    │   ├── unit_count
    │   └── average_unit_price
    ├── last_7_days
    └── last_30_days
```

## 第一阶段时间口径

Marketplace：US。

- `today`：America/Los_Angeles 当地自然日 00:00 至当前时刻；
- `last_7_days`：从 6 个自然日前的 00:00 至当前时刻；
- `last_30_days`：从 29 个自然日前的 00:00 至当前时刻。

调用使用 `granularity=Total`，避免在第一阶段将日明细误当成最终报表口径。

## 数据安全

SalesSnapshot 属于经营敏感数据。

- 完整 Snapshot 只进入 Cloudflare KV；
- Git 不保存真实销售金额；
- Actions 日志只输出是否成功、币种和非敏感接入状态，默认不打印真实销售额；
- Web UI 当前只展示聚合经营指标；
- 不读取或保存买家 PII。

## UI 使用

运营驾驶舱：

- 销售额：根据当前时间范围展示 SalesSnapshot；
- 订单量：根据当前时间范围展示 SalesSnapshot；
- Units：作为后续库存覆盖天数和销售速度模型输入；
- 数据更新时间：显示 observed_at；
- 数据状态：REAL / STALE / ERROR。

## 后续扩展

第二阶段再建设 ProductSalesSnapshot（单品销售快照）。

单品维度需控制 Sales API 调用速率，不能在浏览器对 20+ SKU 即时循环请求；建议通过定时后端 Job / Queue 分批刷新，再落 KV/D1。
