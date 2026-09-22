# REAL-P3-02｜SP-API只读能力

## 目标

在已机器验证的 `01_只读Connector` Contract 之上实现真实可发起 HTTP GET 的 SP-API Transport，同时保持默认测试完全离线、无生产凭据。

## 官方协议基线

- NA endpoint：`https://sellingpartnerapi-na.amazon.com`
- EU endpoint：`https://sellingpartnerapi-eu.amazon.com`
- FE endpoint：`https://sellingpartnerapi-fe.amazon.com`
- access token 通过 `x-amz-access-token` 请求头发送；
- 读取 `x-amzn-RequestId` 与 `x-amzn-RateLimit-Limit`；
- 401 / 403 → auth fail closed；
- 429 → rate-limit；
- timeout → timeout；
- 当前只实现 HTTP GET，不提供 POST/PUT/PATCH/DELETE。

## V1只读Operation映射

- `spapi.catalog.get_item` → Catalog Items `GET /catalog/2022-04-01/items/{asin}`
- `spapi.listings.get_item` → Listings Items `GET /listings/2021-08-01/items/{sellerId}/{sku}`
- `spapi.inventory.get_summaries` → FBA Inventory `GET /fba/inventory/v1/summaries`

## Secret边界

Transport 持有 `SecretRef + SecretProvider`，每次请求临时 resolve access token；token 仅进入 HTTP header，不进入 request model、response model、trace、普通日志或施工文件。

## 测试边界

pytest 使用 Fake HTTP client，验证完整 URL、query、header、安全错误映射和 source metadata；CI 不调用 Amazon。

## 成熟度

当前：`IMPLEMENTATION_IN_PROGRESS`

机器 CI PASS 后仅可标记 `SPAPI_READ_CAPABILITY_VERIFIED`，仍不等于真实账号 `AUTH_VERIFIED / READ_VERIFIED / LIVE_DATA_VERIFIED`。
