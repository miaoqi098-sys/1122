# FinanceSnapshot.v1

## 目标

通过 Amazon Finances API（财务接口）建立 1122 的财务快照，为经营驾驶舱的费用、退款、Amazon 净财务流以及后续利润模型提供真实数据基础。

## 数据源

Amazon Finances API `2024-06-19`：

`GET /finances/2024-06-19/transactions`

第一阶段读取最近 30 天已入账交易，采用后端分页，不读取或保存买家姓名、地址、电话等 PII（个人信息）。

## Canonical Object（规范对象）

```text
FinanceSnapshot
├── schema
├── marketplace
├── observed_at
├── posted_after
├── posted_before
├── source
├── currency
├── transaction_count
├── net_amount
└── by_transaction_type[]
    ├── transaction_type
    ├── count
    └── total_amount
```

## 业务语义

`net_amount` 仅表示 Amazon Finances API 返回的财务交易金额净和，不等于 Contribution Profit（贡献利润）。

真实贡献利润至少还需要：
- 商品采购成本；
- 头程；
- 广告花费；
- 其他内部成本；
- 必要的退款/退货成本口径。

因此 FinanceSnapshot 接入后，运营驾驶舱可以显示“Amazon 财务数据已接”，但在利润模型完成前不得把 `net_amount` 标成“利润”。

## 安全

- 完整金额只保存于 Cloudflare KV 私有数据层；
- Git 不保存真实财务数据；
- Actions 日志默认只输出连接成功、交易数量、币种和更新时间，不输出真实金额；
- Web 身份认证完成前，公共状态接口不返回金额；
- 不保存不必要的 ORDER_ID 等相关标识到聚合 Snapshot。
