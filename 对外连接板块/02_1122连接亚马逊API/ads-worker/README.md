# 1122 Amazon Ads Bridge

独立于 Amazon SP-API Worker 的只读 Amazon Ads OAuth 与查询 Bridge。

## 必需的 Worker Secrets

- `AMAZON_ADS_CLIENT_ID`
- `AMAZON_ADS_CLIENT_SECRET`
- `AMAZON_ADS_TOKEN_ENCRYPTION_KEY`（随机、高熵值；用于加密写入 D1 的首次授权 refresh token）

可选：`AMAZON_ADS_REFRESH_TOKEN`。如已存在，Worker 会优先使用该 Worker Secret；首次 OAuth 成功后 token 仅以 AES-GCM 密文写入 `1122-core` D1，绝不回传、记录或提交。

`AMAZON_ADS_REDIRECT_URI` 应设为 `https://1122-amazon-ads-bridge.zhangshuaibing01.workers.dev/oauth/callback`，以便部署域名变更时仍能严格匹配 Amazon 已登记的 callback。

首次部署后，先应用 D1 migration，再通过 `/oauth/start` 发起授权。当前只开放 GET `/profiles` 与 GET `/campaigns?profile_id=...`；后续 ad-groups、keywords、targets、reports 保持同一授权与区域路由层。

## 当前 API 规范

NA 的 LWA 授权与 token 端点分别为 `https://www.amazon.com/ap/oa` 和 `https://api.amazon.com/auth/o2/token`；Ads API 基址为 `https://advertising-api.amazon.com`。Profiles 使用 `/v2/profiles`，Sponsored Products Campaigns 的只读 MVP 使用 `/v2/sp/campaigns`，并按 Amazon 要求附带 `Authorization`、`Amazon-Advertising-API-ClientId` 和（Campaigns）`Amazon-Advertising-API-Scope`。这与仓库中 SP-API Worker 的 `sellingpartnerapi-na.amazon.com` 体系不同，两个 token/endpoint 不能混用。
