# Cloudflare API 对接说明

## 目标

让 1122 通过 Cloudflare API 读取并后续管理：

- `sorilo-uk.com` Zone（域名区域）状态；
- DNS 记录；
- Pages 项目 `sorilo-uk`；
- Pages 自定义域名状态；
- 后续 HTTPS / SSL、部署、域名绑定等自动化。

## 凭据安全

Cloudflare API Token 不得提交到 GitHub 文件、代码或 README 中。

统一保存为 GitHub Actions Secret（GitHub Actions 加密密钥变量）：

`CLOUDFLARE_API_TOKEN`

## 建议 Token 权限

为了完成当前阶段的只读健康检查与后续自动化，建议至少具备：

- Account（账户）→ Cloudflare Pages → Edit（编辑）
- Zone（域名区域）→ Zone → Read（读取）
- Zone（域名区域）→ DNS → Read（读取）或 Edit（编辑，若后续需要自动改 DNS）

资源范围尽量限制到当前 Cloudflare 账户与 `sorilo-uk.com`，遵循最小权限原则。

## 已建立自动检查

GitHub Actions 工作流：

`.github/workflows/cloudflare-api-health-check.yml`

该工作流通过手动运行执行：

1. Verify API Token（验证 API 令牌）；
2. Resolve Zone / Account（识别 sorilo-uk.com 的 Zone ID 与 Account ID）；
3. Check Pages Project（检查 `sorilo-uk` Pages 项目）；
4. Check Custom Domains（检查 Pages 自定义域名）；
5. Check DNS Records（检查根域 DNS 记录）；
6. 输出连接结果。

## 当前阶段

第一阶段只做连接验证和状态读取，不自动修改 DNS 或删除资源。

验证成功后，再增加：

- 自动绑定 `sorilo-uk.com` 到 Pages；
- DNS 自动修复；
- Pages 部署状态查询；
- HTTPS / SSL 健康检查；
- 1122 UI 对外连接中心读取 Cloudflare 状态。
