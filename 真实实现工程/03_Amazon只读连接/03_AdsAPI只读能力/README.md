# REAL-P3-03｜Ads API只读能力

## 目标

在已机器验证的 `01_只读Connector` Contract 之上实现 Amazon Ads API 的 Sponsored Products 只读能力。

本模块坚持“业务语义只读”而不是“只允许 HTTP GET”：Amazon Ads 的部分 list/read 接口使用 HTTP POST，因此只有显式进入 `ReadOperation` allowlist 的 POST 才允许执行；任何 create/update/delete operation 仍全部 fail closed。

## 当前官方区域端点

- NA：`https://advertising-api.amazon.com`
- EU：`https://advertising-api-eu.amazon.com`
- FE：`https://advertising-api-fe.amazon.com`

区域必须由受控 Profile/Region 映射决定，禁止调用任意自定义 host。

## V1只读Operation

- `ads.campaigns.list` → Sponsored Products `POST /sp/campaigns/list`
- `ads.ad_groups.list` → Sponsored Products `POST /sp/adGroups/list`
- `ads.keywords.list` → Sponsored Products `POST /sp/keywords/list`

这些 POST 仅用于列表读取，不开放 campaign/ad group/keyword 的创建、修改、归档或删除。

## 认证与Profile边界

请求所需：
- OAuth access token：仅通过 `SecretProvider + SecretRef` 临时 resolve；
- Amazon Ads API client id：作为受控配置注入，不写入 trace；
- profile id：由 `AdsProfileResolver` 根据 seller/marketplace 解析，不允许调用者任意覆盖区域 host。

## 错误与Source Trace

- 401 / 403 → `ConnectorAuthError`；
- 429 → `ConnectorRateLimitError`；
- timeout → `ConnectorTimeoutError`；
- 其他非 2xx → sanitized `AdsApiHttpError`；
- 保留 request id / rate-limit / response status；
- 不记录响应 body 中可能包含的敏感上下文。

## 测试边界

pytest 使用 Fake HTTP client / Static Profile Resolver，不调用生产 Amazon Ads API，不携带真实 token/profile/client secret。

## 成熟度

当前：`IMPLEMENTATION_IN_PROGRESS`

只有真实代码、测试、L1 与 P3 CI 机器 PASS 后才可升级为 `ADSAPI_READ_CAPABILITY_VERIFIED`；仍不代表 `AUTH_VERIFIED / READ_VERIFIED / LIVE_DATA_VERIFIED`。
