# 广告板块

运营二级中心，负责自有 Amazon 广告的结构、流量、花费、转化与受控优化。

## 当前三级结构
- 广告总览
- Campaign / Ad Group
- Keyword / Targeting
- Search Term
- Budget / Bid / Placement

其中只有 Profiles、Campaigns 与 Ad Groups 已接入真实只读数据；其余入口仍是后续能力范围，不代表数据或操作已经开放。

## 主要数据源
Amazon Ads API（独立于 SP-API）。

## 主要 Agent
Agent-4 广告智能体；跨域最终经营决策仍由 Agent-1 输出。

## 当前状态

| 维度 | 当前状态 |
|---|---|
| 区域连接 | `CONNECTED`：Amazon Ads NA 已连接 |
| Profiles | 真实读取为 4 个 |
| US 广告结构 | 当前真实 US Profile 返回 1 个 Campaign、2 个 Ad Groups |
| 数据模式 | `LIVE_READ / READ_ONLY` |
| 写能力 | `CLOSED`：预算、竞价、状态、关键词、否定词等写操作均未开放 |

上述数量是最近一次真实读取快照。页面应在每次请求后显示检查时间与错误状态；读取失败时保持未知，不能用 0 或旧快照伪装成功。

## OAuth 授权

除标准回调外，Web Console 已支持紫鸟手工三步：

1. 在连接设置页生成一次性 Amazon 授权链接；
2. 把链接复制到紫鸟，登录并点击允许；
3. 将紫鸟地址栏中的完整 Amazon 回跳地址粘贴回连接设置页，提交后由 Worker 校验 `code` 与一次性 `state` 并完成授权。

授权码、回跳地址和 Token 不得发到聊天、日志或 GitHub；前端不持久化这些敏感值。

## 页面入口

- 广告工作台：`#/operations/ads`
- 连接与 OAuth 设置：`#/connectors/amazon-ads`

两个入口属于 Web Console V2 的同一套路由，不是两套控制台。

未来如开放竞价、预算、暂停关键词、否定词、Campaign 状态变更等动作，必须通过 Task Center、审批与受控 Executor；当前尚未开放这些操作。

CORS 仅是浏览器跨域规则，不是用户鉴权。Cloudflare Access 或等价会话鉴权需等用户确认允许身份后再配置。
