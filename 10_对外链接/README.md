# 10_对外链接

本板块负责总工程与外部平台、外部执行器、第三方服务和企业基础设施之间的长期链接。

当前正式入口：

```text
10_对外链接/
├── README.md
└── 01_GPT链接Codex/
    ├── GPT链接Codex_长期执行入口.md
    └── gpt-codex-control.json
```

## 01_GPT链接Codex

用途：把 GPT 的任务决策通过 GitHub 持久控制面交给 AACC 的 CodexBridge / LocalOps，再由 NODE-001 上的 Codex 或固定本地动作执行。

长期入口：

`01_GPT链接Codex/GPT链接Codex_长期执行入口.md`

机器配置：

`01_GPT链接Codex/gpt-codex-control.json`

## 后续扩展原则

后续 Amazon SP-API、Amazon Ads API、Cloudflare、邮件、第三方数据平台等外部连接，应继续在本板块建立各自独立连接目录，不与 GPT→Codex 执行控制链混用 Secret、权限或执行状态。
