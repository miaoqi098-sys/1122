# 1122 连接 Sif

## 定位
负责网页版智能体 1122 与 Sif 关键词/流量/竞品/广告研究能力之间的正式连接。

## 官方接入方式
优先使用 Sif MCP（Model Context Protocol，模型上下文协议），不使用网页抓取、Cookie 复用或浏览器自动化作为正式数据通道。

- MCP Endpoint（接口地址）：`https://mcp.sif.com/mcp`
- 1122 公共 API：`https://sif-api.sorilo-uk.com`（自定义域，供 1122 与紫鸟环境优先访问）
- Worker 备用地址：`https://1122-sif-bridge.zhangshuaibing01.workers.dev`
- MCP 密钥管理：`https://www.sif.com/mcp?tab=secret`
- 认证：`secret-key` Header（请求头）；Sif 官方同时兼容 URL `?secret-key=` 方式，但 1122 不把密钥放进 URL。
- Secret（加密密钥）名称：`SIF_MCP_SECRET`
- 1122 控制台登录口令：优先 `WEB_CONSOLE_ACCESS_KEY`（只配置为 SIF Bridge Worker Secret）；迁移期间，现有 `SIF_RESEARCH_ACCESS_KEY` 作为兼容登录密码来源
- 1122 会话签名密钥：优先 `WEB_CONSOLE_SESSION_SIGNING_KEY`（高熵值；SIF 与 Ads Bridge 使用同一值验证短时会话）；未配置时 SIF 仅在服务端以 `SIF_MCP_SECRET` 和域隔离 HMAC 作为迁移签名来源
- `SIF_RESEARCH_ACCESS_KEY` 不再进入网页；保留其既有非 UI 调用兼容性，并可作为过渡期的统一登录密码来源
- 默认站点：`US`

## 1122 架构

```text
1122 Web
  ↓
1122-sif-bridge（Cloudflare Worker）
  ↓
Worker Secret: SIF_MCP_SECRET
  ↓
https://mcp.sif.com/mcp
  ↓
Sif MCP Tools
  ↓
选品 / 运营 / A3竞品 / A4广告 / A5流量 / A1决策
```

## 第一阶段
1. 部署 `1122-sif-bridge`；
2. Worker Secret 保存 `SIF_MCP_SECRET`；
3. 通过 MCP initialize（初始化）验证真实连接；
4. 查询 tools/list（工具列表）并只向前端返回工具数量、协议版本等非敏感状态；
5. 1122 对外连接中心显示 Sif 连接状态。

## 第二阶段能力
计划按业务域封装 Sif MCP Tool：

- 反查流量词 / ASIN 关键词信号；
- Listing 关键词分布；
- 关键词需求与历史趋势；
- 关键词竞争格局；
- ASIN 流量结构与趋势；
- 竞品运营/流量诊断；
- ASIN 广告结构、广告流量趋势、广告活动变化；
- 异常诊断与机会发现。

## 竞品关键词工作台

正式业务入口位于 `运营 → 竞品 → 关键词工作台`，SIF 连接页只显示健康状态。

默认调用 `ops_get_asin_traffic_trend_detail`，因为它可以按 ASIN、时间周期和页码返回真实关键词级流量明细。`market_get_asin_aba_footprint` 只覆盖 ABA 点击前三卡位，`market_get_asin_keyword_signals` 最多返回 300 个诊断信号，都不能替代分页流量词并集。

公开元数据接口：

- `GET /research-status`
- `GET /api/v1/keyword-taxonomy`

统一登录会话接口（仅正式 `https://1122.sorilo-uk.com` Origin 可调用；预览和旧站点不能签发会话）：

- `POST /access/session`：以 `WEB_CONSOLE_ACCESS_KEY` 验证登录口令并签发短时会话；
- `GET /access/session`：验证当前会话，不回传口令或 Token。

受 1122 签名会话 Bearer 保护的业务接口：

- `POST /api/v1/competitor-keyword-runs`
- `GET /api/v1/competitor-keyword-runs`
- `GET /api/v1/competitor-keyword-runs/{job_id}`
- `GET /api/v1/competitor-keyword-runs/{job_id}/asins`
- `GET /api/v1/competitor-keyword-runs/{job_id}/keywords`

每个批次最多 10 个合法 ASIN。Worker 先按 ASIN 建立任务，再把每一页采集和每一批分类拆成可续跑 Queue 消息，消费者并发上限为 2；SIF 429、网络和超时只做有限重试。每个 ASIN 每页 200 行、最多 20 页，达到上限必须写入 `is_truncated=1`。分页采集使用可过期页租约与 `next_page_num` CAS，分页结果和分类结果均使用幂等 upsert；因此 Queue 至少一次投递不会并发重复处理同一个 SIF 页或覆盖已完成状态。

写入使用 SQLite `json_each` 批量展开，而不是逐词发起 D1 查询；分类每批 200 词并记录 `classification_offset`。这样在 Workers Free 的单次 D1 查询上限内也可以处理数千关键词。

原始 SIF 分页响应继续进入 `external_tool_observations`；规范词、任务分类快照和 ASIN 来源证据进入 `1122-core`。浏览器不保存词库，也不持有 `SIF_MCP_SECRET` 或 `SIF_INTERNAL_TOKEN`。

## 安全边界
- `SIF_MCP_SECRET` 不提交 GitHub、不写入 1122 前端、不写 localStorage；
- `WEB_CONSOLE_ACCESS_KEY`、`WEB_CONSOLE_SESSION_SIGNING_KEY`、`SIF_RESEARCH_ACCESS_KEY` 与 `SIF_MCP_SECRET` 均不提交 GitHub、不写入网页或浏览器存储；专用 Web Console Secret 配置后会自动优先于迁移回退；
- Web Console 只把短时签名会话保留在当前浏览器 tab 的 `sessionStorage`，不保存登录口令；默认 4 小时、最长 8 小时，关闭 tab、会话到期或轮换签名密钥后需重新登录；
- `POST /access/session` 先用 `CORE_DB` 按可信 `CF-Connecting-IP` 的 HMAC 标识做固定窗口限流（每分钟最多 5 次）；没有 D1、可信客户端 IP 或限流表时失败关闭，不记录原始 IP 或口令；
- 启用 `WEB_CONSOLE_ACCESS_KEY` 前，域名管理员仍必须在 Cloudflare WAF 为 `sif-api.sorilo-uk.com` 的 `POST /access/session` 配置按源 IP 计数的 Rate Limiting 规则并验证其拦截效果，以覆盖分布式猜测；这属于 Zone 外部安全配置，不能由网页或 Worker 代码假定为已存在；
- 不在 URL 中传 MCP 密钥，避免日志/历史记录泄露；
- 公开 1122 页面第一阶段只读取粗粒度连接状态，不开放任意 MCP Tool 代理；
- 真实数据查询只通过预定义业务接口暴露，禁止任意 JSON-RPC 转发；
- 调用额度、失败重试和审计进入任务/事件层统一管理；
- CORS allow-list 不是身份认证；任何消耗 SIF 额度或读取经营词库的接口必须验证 1122 会话。Cloudflare Access 可在未来作为更强的身份层叠加，但不会替代现有任务、额度和审计边界。
