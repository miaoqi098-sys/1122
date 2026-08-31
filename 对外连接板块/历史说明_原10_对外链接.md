# 10_对外链接

本板块负责总工程与外部平台、外部执行器、第三方服务和企业基础设施之间的长期链接。

## 当前正式结构

```text
10_对外链接/
├── README.md
└── 01_GPT链接Codex/
    ├── README.md
    ├── 01_长期连接架构/
    ├── 02_GPT入口/
    ├── 03_本地网关/
    ├── 04_Codex执行器/
    ├── 05_权限与授权/
    ├── 06_认证与长期会话/
    └── 07_运行与恢复/
```

## 01_GPT链接Codex

用途：建设**独立于 AACC、独立于 GitHub Issue 中转**的长期 GPT→Codex 直连能力。

正式目标链：

```text
任意已授权 GPT 对话
↓
ChatGPT 自定义 MCP 应用
↓
长期认证 / 安全远程通道
↓
GPT-Codex Gateway
↓
Codex App Server
↓
Codex
```

入口：

`01_GPT链接Codex/README.md`

机器发现配置：

`01_GPT链接Codex/02_GPT入口/connection-manifest.json`

### 独立性

- AACC 是另一个完全独立的系统，不属于本连接链。
- GitHub 只承担代码、版本、备份等职责，不承担每次 GPT→Codex 执行任务的消息中转。
- AACC 停机或 GitHub执行额度不足，不应使本长期连接失效。

## 后续扩展原则

Amazon SP-API、Amazon Ads API、Cloudflare、邮件、第三方数据平台等外部连接继续在本板块建立各自独立目录。凭证通过本机受保护 Secret Store 使用，不把 Secret 写入 GitHub、普通日志或 GPT 对话。
