# 1122 Amazon Ads Bridge

独立于 Amazon SP-API Worker 的只读 Amazon Ads OAuth 与查询 Bridge。

## 当前已验证状态

- 区域：NA；
- 连接：`CONNECTED`；
- Profiles：真实读取 4 个；
- 当前真实 US Profile：1 个 Campaign、2 个 Ad Groups；
- 能力边界：Profiles、Campaigns、Ad Groups 只读；所有 Ads 写操作关闭。

这些数量是最近一次真实 API 读取快照，不是固定配置。请求失败时必须报告未知或错误，不能以 0 或旧快照替代实时结果。

## 必需的 Worker Secrets

- `AMAZON_ADS_CLIENT_ID`
- `AMAZON_ADS_CLIENT_SECRET`
- `AMAZON_ADS_TOKEN_ENCRYPTION_KEY`（随机、高熵值；用于加密写入 D1 的首次授权 refresh token）

可选：`AMAZON_ADS_REFRESH_TOKEN`，仅作为未写入 D1 时的引导或故障回退。OAuth 成功后的 token 仅以 AES-GCM 密文写入 `1122-core` D1，后续优先读取 D1，使重新授权能够真正切换生效；任何 token 都不会回传、记录或提交。

`AMAZON_ADS_REDIRECT_URI` 应设为 `https://1122-amazon-ads-bridge.zhangshuaibing01.workers.dev/oauth/callback`，以便部署域名变更时仍能严格匹配 Amazon 已登记的 callback。

部署或重新初始化时先应用 D1 migration，再发起 OAuth 授权。当前开放 GET `/profiles`、GET `/campaigns?profile_id=...` 与 GET `/ad-groups?profile_id=...&campaign_id=...`；后续 keywords、targets、reports 保持同一授权与区域路由层。D1 可用，但 D1 绑定或读取成功不等于 Amazon 数据仍然新鲜。

## 紫鸟手工回跳授权

当紫鸟无法打开 1122 或 `workers.dev` 回调页时，可使用 Web Console 中的正式手工三步回跳流程：

1. 在 Web Console 的 Amazon Ads 连接设置页生成授权链接；后台通过 `GET /oauth/manual/start` 创建一次性高熵 `state`。LWA Security Profile `1122 Ads Integration` 需预先允许 `https://amazon.com` 作为 Return URL，并保留 Worker callback。
2. 把授权链接复制到紫鸟，点击 Allow；随后从地址栏复制包含 `code` 与 `state` 的完整 `https://amazon.com/...` 回跳地址。
3. 把完整回跳地址粘贴回 Web Console 并提交。前端只在内存中接收，通过 TLS 调用 `POST /oauth/manual/complete`，随后立即清空；Worker 校验 Amazon 主机名和一次性 `state`，在后端交换 Token，并只在成功读取真实 Profiles、且新授权至少匹配一个原有 Profile 后，以 AES-GCM 密文更新 D1 中的 refresh token。该连续性校验用于阻止其他 Amazon 账户覆盖现有绑定。

授权码和完整回跳地址不得发送到聊天、日志或 GitHub。access token、refresh token 与 Client Secret 始终不会返回前端。手工 state 最长 10 分钟有效且只能使用一次；Amazon authorization code 应在 5 分钟内提交。

## 当前 API 规范

NA 的 LWA 授权与 token 端点分别为 `https://www.amazon.com/ap/oa` 和 `https://api.amazon.com/auth/o2/token`；Ads API 基址为 `https://advertising-api.amazon.com`。Profiles 使用 `/v2/profiles`。Sponsored Products Campaigns 使用当前 v3 列表规范：`POST /sp/campaigns/list` 与 `application/vnd.spCampaign.v3+json`；广告组使用 `POST /sp/adGroups/list` 与 `application/vnd.spAdGroup.v3+json`。列表会沿 `nextToken` 完整翻页，并在 25 页或重复 token 时失败关闭，不把首屏数量冒充总数。仓库旧用法 `GET /v2/sp/campaigns` 已从本 Worker 移除。请求按 Amazon 要求附带 `Authorization`、`Amazon-Advertising-API-ClientId` 和广告 Profile 对应的 `Amazon-Advertising-API-Scope`。这与仓库中 SP-API Worker 的 `sellingpartnerapi-na.amazon.com` 体系不同，两个 token/endpoint 不能混用。

## 安全与访问边界

- Worker 与 Web Console 当前只提供读取和 OAuth 能力，不提供预算、竞价、Campaign / Ad Group 状态或其他广告写接口。
- Profiles、Campaigns、Ad Groups 与手工授权接口要求登记的 1122 `Origin`；无来源请求会失败关闭。请求方仍能伪造 `Origin`，因此这只是收窄暴露面，不能替代真正身份鉴权。
- CORS allow-list 不是用户鉴权。Cloudflare Access 或等价会话鉴权须等用户确认允许身份后配置。
- 完成会话鉴权也不自动授予 Ads 写权限；未来写操作仍须经过 Task、审批、权限边界、受控 Executor 与结果验证。
