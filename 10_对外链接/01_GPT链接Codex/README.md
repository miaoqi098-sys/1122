# GPT 链接 Codex｜当前真实实现

## 目标

本目录只保留当前已经实际运行或正在实际验收的 GPT→Codex 链路，不再保留已停止的 Full MCP、远程 OAuth、旧快捷任务等方案。

## 当前真实链路

```text
GPT
  ↓ GitHub `codex-dispatch` 白名单任务
本机 Controlled Codex Task Bridge
  ↓
GPT-Codex Gateway（127.0.0.1:8765）
  ↓
Codex App Server
  ↓
Codex
  ↓
本地文件 / CLI / Git / 已授权 API
  ↓
结果回写 GitHub
  ↓
GPT 读取结果继续决策
```

## 当前目录

```text
01_GPT链接Codex/
├── README.md
├── 03_本地网关/
│   ├── gateway-contract.json
│   └── runtime/
├── 07_运行与恢复/
│   ├── install-gateway.ps1
│   ├── uninstall-gateway.ps1
│   └── 健康检查与恢复.md
└── 09_GitHub任务桥/
    ├── README.md
    ├── install-bridge.ps1
    ├── worker.py
    └── task-schema.json
```

## 职责分工

- GPT：总控、需求拆解、方案、GitHub 修改、验收、后续决策。
- Codex：仅执行 GPT 当前无法直接完成的本机或已授权平台操作。
- Gateway：本机常驻 MCP / Codex App Server 控制层。
- GitHub任务桥：跨对话任务投递与结果回写通道，只接受白名单任务，不提供任意远程 Shell。

## 当前状态

- `LOCAL_RUNTIME_VERIFIED`：已完成。
- Gateway 常驻：已完成。
- Codex App Server：已完成真实任务验证。
- GitHub任务桥 Worker：已启动并进入真实任务验收。
- 当前白名单任务：`website_online`。
- 当前首要业务目标：让 `https://sorilo-uk.com` 正常上线并启用 HTTPS。

## 已停止并删除的旧路线

以下路线不再施工，也不再作为当前工程依赖：

- ChatGPT Full MCP 远程直连方案；
- Secure MCP Tunnel / 远程 OAuth 长期认证方案；
- 旧 `connection-manifest`；
- 旧“任意 GPT 对话接入规范”；
- 已被真实 Gateway Runtime 取代的 Codex App Server 适配说明；
- 已被真实 Runtime 权限配置取代的旧权限策略文件；
- 已被 `09_GitHub任务桥` 取代的本地快捷任务方案。

以后新增能力优先在当前真实链路上扩展，不再并行维护未使用的旧架构。
