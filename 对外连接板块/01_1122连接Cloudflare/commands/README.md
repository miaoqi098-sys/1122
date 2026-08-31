# Cloudflare 命令队列

本目录是 1122 的 Cloudflare **写入命令入口**。

工作流：

`ChatGPT / 1122 → GitHub 提交命令 JSON → Cloudflare Command Bridge → Cloudflare API`

每个命令必须使用唯一文件名和唯一 `command_id`。GitHub Actions 只执行当前提交中新增或修改的 `.json` 命令文件，因此不会在普通代码提交时重复执行历史命令。

## 当前允许动作

- `status.read`：读取 Zone、DNS、Pages 和自定义域名状态；
- `pages.bind_custom_domain`：把允许域名绑定到 `sorilo-uk` Pages 项目；
- `pages.read_custom_domain`：读取 Pages 自定义域名状态；
- `dns.list`：读取 DNS；
- `dns.upsert_record`：创建或更新允许范围内的 DNS 记录，要求 `confirm=true`；
- `website.publish`：把 API 资质官网目录部署到 `sorilo-uk` Pages，并绑定 `sorilo-uk.com`，要求 `confirm=true`。

## 安全边界

- 命令不能覆盖 Cloudflare Account ID、Zone、Pages 项目和官网目录；这些值固定在 `cloudflare.config.json`。
- 域名写入只允许 `sorilo-uk.com` 和 `www.sorilo-uk.com`。
- 当前不提供删除 DNS、删除 Pages 项目、删除 Worker、修改账户成员、账单或 API Token 等高风险动作。
- `CLOUDFLARE_API_TOKEN` 必须存放在 GitHub Actions Secrets，不得写入命令 JSON 或仓库文件。
- 所有动作都有 GitHub commit 和 Actions 日志，便于审计和回滚。

## 示例：正式发布官网

```json
{
  "command_id": "cf-example-publish-001",
  "action": "website.publish",
  "confirm": true,
  "params": {}
}
```

示例仅用于说明，实际执行时请使用新的唯一命令文件和 `command_id`。
