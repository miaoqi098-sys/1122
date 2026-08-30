# 远程 MCP 接入 V1

## 目标

把已经在本机验证通过的 GPT-Codex Gateway 从 `127.0.0.1:8765` 接入 ChatGPT，使拥有本应用权限的**任意新 GPT 对话**可以复用同一个长期连接调用 Codex，而不需要 GitHub Issue、AACC 或每任务重新授权。

## 当前已验证

- Windows 常驻 Gateway：已验证；
- MCP `/mcp/` initialize：已验证；
- MCP `tools/list`：已验证；
- Codex App Server：已验证；
- `thread/start` / `turn/start`：已验证；
- 真实 Codex 任务完成并写回 SQLite：已验证；
- 本地状态：`LOCAL_RUNTIME_VERIFIED`。

## 正式目标链

```text
ChatGPT 新对话
  ↓
亚马逊智能体 Codex 执行器（自定义 MCP 应用）
  ↓
长期授权
  ↓
OpenAI Secure MCP Tunnel / 受支持远程 MCP 通道
  ↓
127.0.0.1:8765/mcp/
  ↓
GPT-Codex Gateway
  ↓
Codex App Server
  ↓
Codex
```

## 长期连接要求

1. 第一次应用授权后复用同一应用授权；
2. OAuth/OIDC 场景必须支持 refresh token；
3. 支持 `offline_access` 或提供方等价能力；
4. access token 到期后自动刷新；
5. 不采用“每个 Codex 任务重新授权”；
6. 不把本机 8765 直接无认证暴露到公网；
7. 不依赖 AACC；
8. GitHub 不作为运行时任务总线。

## OpenAI 产品侧现状（2026-08-30）

根据 OpenAI 当前官方说明，包含写入/修改动作的 Full MCP 目前面向 ChatGPT Business、Enterprise 和 Edu。当前账户若仅为 Plus，则可以继续建设和验证本地/远程技术层，但不能把本应用作为 ChatGPT Plus 任意新对话中的 Full MCP 写执行器正式启用。

因此当前阶段定义为：

`REMOTE_MCP_ENGINEERING_IN_PROGRESS`

而不是：

`CROSS_CONVERSATION_VERIFIED`

## 首选远程方式

首选 OpenAI Secure MCP Tunnel，因为它用于将本机/私网 MCP 服务连接到受支持的 OpenAI 产品，而不直接把本机服务暴露到公网。

在没有看到当前账户实际的 Tunnels 页面、真实 Tunnel ID、官方 tunnel-client 安装说明之前，本工程不写死或伪造 tunnel-client 命令。

## 远程验收门

必须全部满足才可标记 `CROSS_CONVERSATION_VERIFIED`：

- ChatGPT 侧自定义 MCP 应用创建成功；
- 应用工具扫描可见 10 个 Codex 工具；
- 首次授权完成；
- 关闭当前聊天；
- 新建一个完全新的 GPT 对话；
- 新对话可调用 `codex_status`；
- 新对话可调用 `codex_start_task`；
- Codex 在本机真实执行；
- 任务最终 `COMPLETED`；
- 新对话不要求重新安装 Gateway；
- 正常 token 续期不要求每任务重新授权。
