# 1122 Web Console V2

这是 1122 当前正式 Web UI 实现。

V2 已收口为一个入口、一个 Navigation Registry 和一个 Hash Router。所有业务页、连接页与系统页都在同一套路由内切换，不再把旧 HTML 页面或 V1 页面当作并行控制台。

## 当前能力

- 经营指挥中心首页
- 统一导航、路由和全局搜索
- 产品、广告、库存物流、竞品与站外运营入口
- APR 市场玩法探索
- AOM 正向运营方法
- APB 政策与边界证据
- Amazon SP-API / Amazon Ads / SIF / Cloudflare / Email 连接状态
- Amazon Ads Profiles、Campaigns 与 Ad Groups 真实只读视图
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
| 会话鉴权 | `PENDING_USER_IDENTITY` | CORS 不是鉴权；待用户确认允许访问的身份后，再配置 Cloudflare Access 或等价会话鉴权 |
| 生产写操作 | `CLOSED` | Web Console 没有 Amazon、Ads、D1 或其他生产写权限 |

Profiles、Campaigns 与 Ad Groups 数量是最近一次真实读取快照，不是固定配置；页面刷新失败时应显示未知或错误，不得沿用旧数字伪装实时成功。

## 本地运行

本项目无第三方依赖，可以直接用任意静态服务器运行。

例如：

```bash
cd web-console
python3 -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

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

本网页仅调用只读的 Status Bridge 与 Data Layer；Cloudflare Token、Amazon Token、账户密钥都不属于 Pages 产物。R2 当前未启用。

## 路由

当前使用一套 Hash Router，避免静态托管环境需要额外 rewrite 配置。`web-console/index.html` 是唯一正式入口，`registry.js` 是页面和连接入口的统一登记表。

- `#/command-center`
- `#/selection`
- `#/operations`
- `#/operations/products`
- `#/operations/ads`
- `#/operations/inventory-logistics`
- `#/operations/competitors`
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

页面必须分别显示传输可达、连接状态、来源状态、新鲜度、语义验证和授权状态。进入 `SNAPSHOT_FALLBACK` 时，不得把仓库快照标记为实时数据。

Amazon Ads 当前验证快照为：NA 连接成功、Profiles = 4、真实 US Profile = 1 Campaign / 2 Ad Groups。当前只开放 Profiles、Campaigns、Ad Groups 读取；Keywords、Targets、Search Terms、Reports 与全部 Ads 写操作均未开放。

## 权限边界

Web Console 本身不拥有生产写权限。CORS allow-list 只限制浏览器跨域请求，不验证操作者身份；Cloudflare Access 或等价会话鉴权须等用户确认允许身份后再配置。

即使将来开放，任何真实 Amazon / Ads 写动作仍必须走：

`Agent-1 → Task → Approval Gate → Permission Boundary → Executor`
