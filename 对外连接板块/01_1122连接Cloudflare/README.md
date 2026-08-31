# 1122连接 Cloudflare

## 定位

1122 是网页版智能体。本目录负责 1122 与 Cloudflare 的域名、DNS、HTTPS、Pages 托管及后续 Workers/Tunnel 等连接建设。

## 当前资源

- 域名：`sorilo-uk.com`
- 域名/DNS 平台：Cloudflare
- GitHub 仓库：`miaoqi098-sys/1122`
- API 资质官网生产分支：`website/api-qualification-v1`
- 官网源目录：`运营板块/站外推广板块/01_品牌官网与独立站/01_API资质官网/site`

## 当前对接目标

第一阶段先完成 Amazon API 资质官网：

`GitHub → Cloudflare Pages → sorilo-uk.com → HTTPS`

Cloudflare Pages 项目配置：

- Repository：`miaoqi098-sys/1122`
- Production branch：`website/api-qualification-v1`
- Root directory：`运营板块/站外推广板块/01_品牌官网与独立站/01_API资质官网/site`
- Framework preset：None
- Build command：空
- Build output directory：`.`

## 建设边界

- 域名与 DNS；
- HTTPS / SSL；
- Cloudflare Pages；
- 1122 网页入口与自定义域名；
- 后续 Workers、Tunnel、缓存、安全策略等能力。

## 安全规则

Cloudflare API Token、Global API Key、账户密码、Amazon Client Secret、Refresh Token 等敏感凭据不得提交 GitHub。若未来自动化操作 Cloudflare，应使用最小权限 API Token，并存放在受保护的 Secrets/凭据系统中。

## 当前状态

GitHub 侧生产分支、网站目录和部署参数已整理完成；Cloudflare 账号侧仍需完成一次 GitHub 授权、Pages 项目创建和自定义域名绑定。
