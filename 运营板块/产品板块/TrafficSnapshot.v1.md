# TrafficSnapshot.v1

## 目标

通过 Amazon Reports API 的 `GET_SALES_AND_TRAFFIC_REPORT` 建立真实流量快照，并将总店铺流量与单 SKU 流量统一到 1122 ProductIdentity。

## 数据源

Amazon Reports API：`GET_SALES_AND_TRAFFIC_REPORT`

报告选项：
- `dateGranularity = DAY`
- `asinGranularity = SKU`
- Marketplace = US

## Snapshot

```text
TrafficSnapshot
├── schema
├── marketplace
├── observed_at
├── report_range
├── by_date[]
│   ├── date
│   ├── sessions
│   ├── page_views
│   ├── buy_box_percentage
│   ├── unit_session_percentage
│   ├── units_ordered
│   ├── order_items
│   └── ordered_product_sales
└── by_product[]
    ├── product_id
    ├── sku
    ├── asin
    ├── parent_asin
    ├── sessions
    ├── page_views
    ├── buy_box_percentage
    ├── unit_session_percentage
    ├── units_ordered
    ├── order_items
    └── ordered_product_sales
```

## 业务价值

TrafficSnapshot 接通后可真实计算：
- 店铺 Sessions / Page Views；
- Unit Session Percentage（转化率口径之一）；
- 单 SKU Sessions 与销量；
- 产品流量变化；
- 7/30 天销售速度；
- InventorySnapshot + Product Traffic → 库存覆盖天数基础输入。

## 异步执行

Reports API 为异步报告：

```text
createReport
↓
reportId
↓
轮询 getReport
↓ DONE
getReportDocument
↓
下载 JSON 报告
↓
标准化 TrafficSnapshot
↓
Cloudflare KV
```

GitHub Actions 负责轮询，不让浏览器长时间等待。

## 安全

- SKU / ASIN / Sessions / 销售金额等完整明细只进入私有 KV；
- Web 身份认证完成前，状态接口只暴露“是否已连接、记录数量、日期范围、更新时间”；
- Actions 日志不打印真实 SKU、ASIN、Sessions、销量或销售金额。
