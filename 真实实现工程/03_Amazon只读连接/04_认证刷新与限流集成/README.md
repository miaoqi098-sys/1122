# REAL-P3-04｜认证刷新与限流集成

## 目标

把 P3-02 / P3-03 已经可用的 access-token 注入和 P3-01 的有限重试，升级为统一的运行能力：

1. LWA access token 按需刷新并缓存；
2. refresh token / client secret 始终只通过 `SecretRef + SecretProvider` 读取；
3. access token 临近过期才刷新；
4. 429 / timeout 采用有界、可测试的退避策略；
5. `Retry-After` 存在时优先采用，但受最大等待上限约束；
6. 全部测试离线，不主动调用 Amazon/LWA 生产接口。

## LWA协议基线

当前实现固定 token endpoint：`https://api.amazon.com/auth/o2/token`。

refresh 请求使用 `application/x-www-form-urlencoded`：
- `grant_type=refresh_token`
- `refresh_token`
- `client_id`
- `client_secret`

成功响应至少解析：
- `access_token`
- `expires_in`
- `token_type`

## 设计边界

### AccessTokenProvider

`CachedLwaAccessTokenProvider`：
- 首次请求时刷新；
- token 未进入 refresh skew 时直接复用；
- 临近过期或已过期时重新刷新；
- refresh 失败 fail closed；
- 异常不携带 OAuth response body 或 Secret。

### SecretProvider桥接

`RefreshingAccessTokenSecretProvider` 把动态 AccessTokenProvider 适配回 P3-02/P3-03 既有 `SecretProvider` Contract，因此无需让 SP-API / Ads Transport 自己实现 token 生命周期。

### Retry / Rate-limit

共享 `AmazonReadConnector` 接受可替换 retry delay policy 与 sleeper：
- auth error 永不重试；
- rate-limit / timeout 最多仍受 `RetryPolicy.max_attempts <= 5` 限制；
- `Retry-After` 优先；
- 无提示时使用指数退避；
- 自动测试使用 fake sleeper，不真实等待。

## 安全边界

- 不提交真实 refresh token / client secret / access token；
- 测试仅使用 dummy secret；
- OAuth 错误不记录 response body；
- access token 不进入 SourceTrace；
- 无 Amazon / Ads 写能力；
- 无自动审批 / Executor。

## 成熟度

当前：`IMPLEMENTATION_IN_PROGRESS`

机器 CI PASS 后只可标记 `AUTH_REFRESH_RATE_LIMIT_VERIFIED`；没有真实授权时仍不得标记 `AUTH_VERIFIED / READ_VERIFIED / LIVE_DATA_VERIFIED`。
