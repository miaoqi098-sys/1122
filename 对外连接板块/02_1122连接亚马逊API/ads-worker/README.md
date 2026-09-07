# 1122 Amazon Ads Bridge

独立于 Amazon SP-API Worker 的只读 Amazon Ads OAuth 与查询 Bridge。

## 必需的 Worker Secrets

- `AMAZON_ADS_CLIENT_ID`
- `AMAZON_ADS_CLIENT_SECRET`
- `AMAZON_ADS_TOKEN_ENCRYPTION_KEY`（随机、高熵值；用于加密写入 D1 的首次授权 refresh token）

可选：`AMAZON_ADS_REFRESH_TOKEN`。如已存在，Worker 会优先使用该 Worker Secret；首次 OAuth 成功后 token 仅以 AES-GCM 密文写入 `1122-core` D1，绝不回传、记录或提交。

`AMAZON_ADS_REDIRECT_URI` 应设为 `https://1122-amazon-ads-bridge.zhangshuaibing01.workers.dev/oauth/callback`，以便部署域名变更时仍能严格匹配 Amazon 已登记的 callback。

首次部署后，先应用 D1 migration，再通过 `/oauth/start` 发起授权。当前开放 GET `/profiles`、GET `/campaigns?profile_id=...` 与 GET `/ad-groups?profile_id=...&campaign_id=...`；后续 keywords、targets、reports 保持同一授权与区域路由层。

## 紫鸟手工回跳授权

当紫鸟无法打开 1122 或 `workers.dev` 回调页时，可使用 Web Console 中的正式手工回跳流程：

1. 在 LWA Security Profile `1122 Ads Integration` 的 Web 设置中新增 Allowed Return URL `https://amazon.com`，并保留原有 Worker callback。
2. Web Console 调用 `GET /oauth/manual/start` 生成包含一次性高熵 state 的 Amazon 授权链接。
3. 用户把链接复制到紫鸟，点击 Allow 后，从紫鸟地址栏复制完整的 `https://amazon.com/...?...code=...&state=...` 地址。
4. Web Console 仅在内存中接收该地址，通过 TLS 提交给 `POST /oauth/manual/complete`，提交后立即清空输入框且不写入浏览器存储。
5. Worker 校验 Amazon 主机名和一次性 state，使用与授权请求完全相同的 `redirect_uri=https://amazon.com` 在后端交换 token。只有新 refresh token 成功读取并校验真实 Profiles 后，才用 AES-GCM 密文替换 D1 中的旧 token。

授权码和完整回跳地址不得发送到聊天、日志或 GitHub。access token、refresh token 与 Client Secret 始终不会返回前端。手工 state 最长 10 分钟有效且只能使用一次；Amazon authorization code 应在 5 分钟内提交。

## 当前 API 规范

NA 的 LWA 授权与 token 端点分别为 `https://www.amazon.com/ap/oa` 和 `https://api.amazon.com/auth/o2/token`；Ads API 基址为 `https://advertising-api.amazon.com`。Profiles 使用 `/v2/profiles`。Sponsored Products Campaigns 使用当前 v3 列表规范：`POST /sp/campaigns/list` 与 `application/vnd.spCampaign.v3+json`；广告组使用 `POST /sp/adGroups/list` 与 `application/vnd.spAdGroup.v3+json`。仓库旧用法 `GET /v2/sp/campaigns` 已从本 Worker 移除。请求按 Amazon 要求附带 `Authorization`、`Amazon-Advertising-API-ClientId` 和广告 Profile 对应的 `Amazon-Advertising-API-Scope`。这与仓库中 SP-API Worker 的 `sellingpartnerapi-na.amazon.com` 体系不同，两个 token/endpoint 不能混用。
