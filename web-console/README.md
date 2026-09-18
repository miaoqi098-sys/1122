# 1122 Web Console V2

这是 1122 当前正式 Web UI 实现。

V2 已收口为一个入口、一个 Navigation Registry 和一个 Hash Router。所有业务页、连接页与系统页都在同一套路由内切换，不再把旧 HTML 页面或 V1 页面当作并行控制台。

## 当前能力

- 经营指挥中心首页
- 统一导航、路由和全局搜索
- 1122 统一登录入口与当前 tab 短时访问会话
- 产品、广告、库存物流、竞品与站外运营入口
- 产品推广计划工作台：按产品展示正式计划读模型状态与可验证经营事实
- 每日工作 SOP 工作台：按风险、诊断、动作、日结四轮节奏审阅事实与 Daily Brief 缺口
- APR 市场玩法探索
- AOM 正向运营方法
- APB 政策与边界证据
- Amazon SP-API / Amazon Ads / SIF / Cloudflare / Email 连接状态
- Amazon Ads Profiles、Campaigns 与 Ad Groups 真实读取视图，以及受控的 Sponsored Products Campaign 状态切换
- 竞品关键词工作台：多 ASIN 自动分批 SIF 任务、严格去重、10 类分类与来源追溯
- Agent 中心
- 任务中心
- 沙盘演练
- 数据中心
- 系统政策边界
- 移动端响应式侧栏

## 当前状态快照

状态必须按维度理解，某一维度成功不能代替其他维度：

| 维度 | 当前状态 | 含义 |
|---|---|---|
| Web Console | `V2 / SINGLE_ROUTER` | 单一 Hash Router 与统一 Registry 已启用 |
| Amazon Ads | `CONNECTED / LIVE_READ` | NA 已连接；真实 Profiles = 4；当前真实 US Profile 返回 1 个 Campaign、2 个 Ad Groups |
| Email | `AUTH_REQUIRED` | 邮箱连接尚缺所需认证配置，不能记为已连接 |
| D1 / KV | `AVAILABLE` | D1 事实读模型与 KV 当前状态层可用；读取成功仍不自动等于数据新鲜或业务语义已验证 |
| R2 | `NOT_ENABLED` | 冷档案层未启用，不得把凭据名称或规划状态写成可用 |
| Pages 发布 | `MANUAL` | 当前从本地手工部署，不依赖 GitHub 自动发布 |
| 会话鉴权 | `SIGNED_ACCESS_SESSION` | 登录口令由 SIF Bridge 服务端校验；网页只保留当前 tab 的短时签名会话 |
| 竞品关键词操作 | `SESSION_PROTECTED` | 1122 登录会话保护任务和词库；不再在关键词页重复输入操作密钥 |
| 外部生产写操作 | `CONTROLLED` | Amazon Ads 仅开放人工确认、幂等且无自动重试的 Sponsored Products Campaign 状态切换；其余 Amazon、商品、价格、库存及广告写操作仍关闭 |

Profiles、Campaigns 与 Ad Groups 数量是最近一次真实读取快照，不是固定配置；页面刷新失败时应显示未知或错误，不得沿用旧数字伪装实时成功。

## 本地运行

本项目无第三方依赖，可以直接用任意静态服务器进行页面壳层、路由与快照的视觉检查。

例如：

```bash
cd web-console
python3 -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

本地静态地址不是登记的登录来源，不能对正式 SIF 登录端点签发会话；需要验证登录、SIF 研究或 Ads 受控操作时，使用正式 `https://1122.sorilo-uk.com` 域名，或在隔离的开发环境另行显式配置登录来源。

## Cloudflare Pages 手工发布

1122 使用现有 Cloudflare Pages 项目 `1122-web-agent`。当前发布方式是从本地手工部署，不依赖 GitHub Actions 或 Git 集成自动发布。发布前需在本机完成 Cloudflare 登录，并确认项目的自定义域名为 `1122.sorilo-uk.com`。

```bash
npx wrangler@4 whoami
npx wrangler@4 pages deploy . --project-name=1122-web-agent --branch=main
```

部署后访问：

```text
https://1122.sorilo-uk.com/#/connectors
```

在 Cloudflare Dashboard 的 **Workers & Pages → 1122-web-agent → Custom domains** 中添加 `1122.sorilo-uk.com`。该域名位于同一 Cloudflare Zone 时，Cloudflare 会管理所需 DNS/HTTPS 配置。不要把 1122 绑定到 `sorilo-uk.com` 根域名，以免覆盖现有主站。

本网页默认只读取 Status Bridge 与 Data Layer。SIF Bridge 优先使用专用 `WEB_CONSOLE_ACCESS_KEY` 与高熵 `WEB_CONSOLE_SESSION_SIGNING_KEY`；在迁移期间，已存在的 `SIF_RESEARCH_ACCESS_KEY` 会作为统一登录密码，`SIF_MCP_SECRET` 只在服务端以域隔离 HMAC 作为会话签名来源，避免把旧研究密钥再次交给网页。若希望使用唯一开放的 Ads 受控写入，还必须在 Amazon Ads Bridge 配置相同的 `WEB_CONSOLE_SESSION_SIGNING_KEY`。登录口令不会写入 Pages、浏览器存储、日志或 GitHub；网页只保存当前 tab 的短时会话。Cloudflare Token、Amazon Token 与 Amazon Client Secret 均不属于 Pages 产物。R2 当前未启用。

`POST /access/session` 先由 SIF Bridge 的 D1 固定窗口限流（每个可信 Cloudflare 客户端 IP 每分钟最多 5 次，客户端 IP 只以 HMAC 标识存储；限流数据库不可用时失败关闭），再校验口令。启用 `WEB_CONSOLE_ACCESS_KEY` 前，仍必须由域名管理员在 Cloudflare WAF 为 `sif-api.sorilo-uk.com` 的 `POST /access/session` 配置按源 IP 计数的 Rate Limiting 规则，并在 Security Events 中验证它能阻断分布式暴力猜测。该规则属于 Cloudflare Zone 的外部安全配置，仓库和 Pages 产物不会代为创建或绕过它。

## 路由

当前使用一套 Hash Router，避免静态托管环境需要额外 rewrite 配置。`web-console/index.html` 是唯一正式入口，`registry.js` 是页面和连接入口的统一登记表。

- `#/command-center`
- `#/selection`
- `#/operations`
- `#/operations/products`
- `#/operations/products/promotion-plan`
- `#/operations/daily-sop`
- `#/operations/ads`
- `#/operations/inventory-logistics`
- `#/operations/competitors`
- `#/operations/competitors/keywords`
- `#/operations/offsite`
- `#/amazon-boundary/apr`
- `#/amazon-boundary/aom`
- `#/amazon-boundary/apb`
- `#/connectors`
- `#/connectors/amazon-sp-api`
- `#/connectors/amazon-ads`
- `#/sandbox`
- `#/agents`
- `#/skills`
- `#/knowledge`
- `#/memory`
- `#/governance`
- `#/tasks`
- `#/data`

## 数据源状态

V2 优先读取 Data Layer 的只读 UI bootstrap，并由各只读 Bridge 独立检查外部连接；`web-console/data/snapshots.js` 仅用于 API 不可用时的降级回退。

当前真实读取面包括：

- D1 中的产品、Agent、任务与知识读模型；
- KV 当前状态；
- Amazon SP-API、Amazon Ads、SIF、Cloudflare 与 Email 的连接状态；
- Amazon Ads NA Profiles，以及所选 Profile 的 Campaign / Ad Group 结构。
- SIF 竞品关键词任务、每 10 个 ASIN 自动分批、分组内严格去重词表、10 类分类和每个关键词的来源 ASIN（使用统一登录会话）。

当前 UI bootstrap 尚未提供 `ProductPromotionPlan.v2` 或 `DailyOperatingBrief.v2` 的正式读模型。两个工作台会明确显示 `PLAN NOT INGESTED` / `NEEDS DATA`，并只呈现可验证的产品和任务事实；它们不会把单日指标、任务或 `product_daily_state.stage` 擅自解释为阶段置信度、主瓶颈、策略、Signal、根因或推荐动作。

页面必须分别显示传输可达、连接状态、来源状态、新鲜度、语义验证和授权状态。进入 `SNAPSHOT_FALLBACK` 时，不得把仓库快照标记为实时数据。

Amazon Ads 当前验证快照为：NA 连接成功、Profiles = 4、真实 US Profile = 1 Campaign / 2 Ad Groups。当前开放 Profiles、Campaigns、Ad Groups 读取，以及人工确认、幂等且不自动重试的单条 Sponsored Products Campaign 状态切换；Keywords、Targets、Search Terms、Reports 与其他 Ads 写操作均未开放。

## 权限边界

Web Console 不拥有生产写权限，也不携带 Amazon 凭据或任意写入密钥。控制台入口、SIF 关键词研究和已配置的 Ads Campaign 状态切换使用统一的短时签名会话；该会话替代旧页面内的重复操作键，但不会绕过既有执行控制。CORS allow-list 仍只限制浏览器跨域请求，不能替代身份认证。

当前会话默认 4 小时有效、最长 8 小时，只用于控制台访问与已明确接入的受控接口；轮换 `WEB_CONSOLE_SESSION_SIGNING_KEY` 会使已签发会话失效。其余既有只读 Bridge 若要作为私有 API 对外发布，仍须接入同一会话或 Cloudflare Access；登录不会把任何公开健康端点自动变为私有，也不会提升业务权限。

即使将来开放，任何真实 Amazon / Ads 写动作仍必须走：

`Agent-1 → Task → Approval Gate → Permission Boundary → Executor`
