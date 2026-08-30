# GPT 链接 Codex｜长期直连工程

## 目标

本目录建设一个**独立于 AACC、独立于 GitHub Issue 中转**的长期 GPT→Codex 执行通道。

正式目标链路：

```text
任意已授权 GPT 对话
        ↓
ChatGPT 自定义 MCP 应用 / 长期入口
        ↓
安全远程通道
        ↓
GPT-Codex Gateway（本地常驻）
        ↓
Codex App Server（主执行器）
        ↓
Codex
        ↓
本地文件 / CLI / Git / API / 工程工具
```

GitHub仅用于源码、版本与备份，不作为每次执行任务的消息总线。

## 两个硬目标

1. **跨对话可用**：在同一已授权 ChatGPT 账户/工作空间中，只要该 GPT-Codex 应用处于启用状态，新开的 GPT 对话也能发现并调用执行工具，不依赖上一段聊天历史。
2. **长期连接**：首次完成应用安装与长期认证后，正常使用依靠刷新令牌/长期会话续期，不把“每个任务重新授权”设计成常态。

> 平台本身如果对某些写操作强制弹出确认，Gateway 不伪造或绕过平台确认；本工程自己的额外确认默认尽量减少。

## 独立性

本工程与 `miaoqi098-sys/amazon-agent-command-center`（AACC）完全独立。

- 不依赖 AACC CodexBridge。
- 不依赖 AACC LocalOps。
- AACC 停机、删除、额度耗尽，不影响本工程设计目标。
- 如未来需要互联，AACC 只能作为一个可选外部系统，不是本工程基础设施。

## 目录

```text
01_GPT链接Codex/
├── README.md
├── 01_长期连接架构/
│   └── 长期连接总纲.md
├── 02_GPT入口/
│   ├── 任意GPT对话接入规范.md
│   └── connection-manifest.json
├── 03_本地网关/
│   └── gateway-contract.json
├── 04_Codex执行器/
│   └── CodexAppServer适配规范.md
├── 05_权限与授权/
│   └── maximum-authority-policy.json
├── 06_认证与长期会话/
│   └── 长期认证规范.md
└── 07_运行与恢复/
    └── 健康检查与恢复.md
```

## 执行器优先级

1. `Codex App Server`：长期进程、双向控制、线程持续、事件流与审批交互。
2. `Codex SDK`：未来可作为原生库适配器。
3. `codex exec`：仅作为本工程自身的降级执行器，不作为长期主链。

## 权限原则

默认采用 **HIGH_AUTHORITY / AUTO_ALLOW_REVERSIBLE**：

- 本机工程文件读写：自动允许。
- 创建/修改/移动/删除工程文件：自动允许（受配置根目录约束）。
- 运行 Shell / PowerShell / Python / Node / 测试 / 构建：自动允许。
- Git commit / branch / push：默认允许。
- 调用已配置的 Cloudflare、Amazon、数据库等连接器：按连接器权限直接执行。
- Secret：允许“使用”，默认不向 GPT 明文展示。

仅对少数不可逆高风险动作保留硬门槛，例如：导出明文凭证、资金转账/支付、删除整个云账户或域名、关闭系统安全能力、整盘擦除等。

## 当前阶段

本目录当前建立的是长期连接的正式架构与机器契约。后续真实实现需完成：

`Gateway Runtime → Codex App Server Adapter → MCP Tools → 长期认证 → ChatGPT App 发布/连接 → 真实跨对话验收`。
