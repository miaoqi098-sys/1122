# 1122 连接 Cloudflare

## 定位

本目录是 1122 与 Cloudflare 的正式连接工程，负责域名、DNS、HTTPS、Pages、Workers、R2 以及后续 Cloudflare 基础设施的读取与受控写入。

1122 是网页模式智能体，因此 Cloudflare 连接分成两条通道：

1. **状态读取通道**：`1122 网页 → 1122-cloudflare-bridge Worker → Cloudflare API`
2. **受控写入通道**：`ChatGPT / 1122 → GitHub 命令 JSON → GitHub Actions → Cloudflare API`

第二条通道建成后，ChatGPT 可以通过 GitHub 下发 Cloudflare 命令，并从 Actions 日志确认执行结果，不需要用户反复进入 Cloudflare 控制台手动操作。

## 当前资源

- Cloudflare Account ID：`bc7efad100a5eb6c7bf5c5b4363dce37`
- Zone：`sorilo-uk.com`
- Zone 状态：`active`
- Pages 项目：`sorilo-uk`
- Pages 默认域名：`sorilo-uk.pages.dev`
- Worker：`1122-cloudflare-bridge`
- Worker 地址：`https://1122-cloudflare-bridge.zhangshuaibing01.workers.dev`
- GitHub 仓库：`miaoqi098-sys/1122`
- 官网源目录：`运营板块/站外推广板块/01_品牌官网与独立站/01_API资质官网/site`

## 目录结构

- `cloudflare.config.json`：固定 Account / Zone / Pages / 官网目录，命令不能覆盖这些边界；
- `cloudflare-command.schema.json`：Cloudflare 命令格式；
- `commands/`：写入命令队列；
- `scripts/cloudflare_connector.py`：Cloudflare API 执行器；
- `worker/worker.js`：当前 Worker 状态桥源代码；
- `.github/workflows/cloudflare-command-bridge.yml`：GitHub → Cloudflare 写入执行通道。

## 当前支持的写入能力

- 读取 Cloudflare 总状态；
- 读取 DNS；
- 绑定 Pages 自定义域名；
- 读取 Pages 自定义域名状态；
- 创建/更新允许范围内的 DNS 记录；
- 一键发布 API 资质官网：部署静态站到 `sorilo-uk` Pages，并绑定 `sorilo-uk.com`。

当前不开放删除 DNS、删除 Pages 项目、删除 Worker、账户成员、账单、API Token 管理等高风险动作。

## GitHub Actions Secret

Cloudflare 写入连接器需要在仓库：

`Settings → Secrets and variables → Actions`

添加：

- 名称：`CLOUDFLARE_API_TOKEN`
- 值：Cloudflare Account API Token

该 Token 只存在于 GitHub Actions Secrets，不得写入 GitHub 文件、命令 JSON、前端代码或日志。

## 命令工作方式

例如正式发布官网时，ChatGPT 可以在 `commands/` 创建：

```json
{
  "command_id": "cf-20260831-publish-001",
  "action": "website.publish",
  "confirm": true,
  "params": {}
}
```

提交到 `main` 后，`Cloudflare Command Bridge` 工作流会自动：

1. 使用 Wrangler 把官网目录部署到 `sorilo-uk` Pages；
2. 调用 Cloudflare Pages API 绑定 `sorilo-uk.com`；
3. 读取 Zone / DNS / Pages / Custom Domain 状态；
4. 把结果写入 GitHub Actions 执行日志供 ChatGPT 检查。

## 安全规则

- Cloudflare API Token、Global API Key、账户密码、R2 Secret Access Key、Amazon Client Secret、Refresh Token 等不得提交 GitHub；
- Cloudflare 写入命令采用 allow-list，不允许命令覆盖 Account ID、Zone、Pages 项目和官网目录；
- DNS 写入仅允许 `sorilo-uk.com` / `www.sorilo-uk.com`；
- 写操作必须明确 `confirm=true`；
- 所有写入都有 GitHub commit + Actions 日志，可审计；
- Worker Secret 与 GitHub Actions Secret 相互独立，不从前端读取高权限密钥。

## 当前状态

Cloudflare Worker 状态读取通道已成功连接：Account Token、Zone、DNS 读取权限、Pages 项目与 R2 凭据均已验证；`sorilo-uk.com` Zone 为 active，Pages 项目 `sorilo-uk` 已识别。

GitHub 写入连接器代码已经建立。只需一次性在 GitHub Actions Secrets 中配置 `CLOUDFLARE_API_TOKEN`，之后 ChatGPT 即可通过 GitHub 命令桥对 Cloudflare 执行受控写入。
