# REAL-P3-05｜P3阶段机器验收

## 目标

对 `01_只读Connector`、`02_SPAPI只读能力`、`03_AdsAPI只读能力`、`04_认证刷新与限流集成` 做阶段级联合机器验收，验证真实代码可以共同工作，同时重新确认第一批运行系统的只读与 Secret 边界。

## 阶段门禁

- P3-01～04 全部 pytest 联合 PASS；
- ReadOperation / READ_ALLOWLIST 不包含经营写操作；
- SP-API Transport 保持 GET-only；
- Ads API 仅 explicit semantic-read operations 可进入 POST list endpoint；
- SourceTrace / ConnectorRequest / TransportRequest 不承载 Secret value；
- OAuth refresh token / client secret 只通过 SecretRef + SecretProvider resolve；
- RetryPolicy 最大尝试次数不超过 5；
- retry delay 有 max-delay 上限；
- P1、P2 exact-head 回归保持 success；
- 无真实 Amazon/LWA/Ads 生产调用。

## 成熟度边界

本文件夹完成后允许标记 `P3_STAGE_MACHINE_VERIFIED`。

在没有真实 seller / marketplace / Ads profile 与授权的情况下，以下状态必须继续为 PENDING：

- `AUTH_VERIFIED`
- `READ_VERIFIED`
- `LIVE_DATA_VERIFIED`

阶段机器验收不得把离线 Fake/Mock 结果冒充生产连接验收。
