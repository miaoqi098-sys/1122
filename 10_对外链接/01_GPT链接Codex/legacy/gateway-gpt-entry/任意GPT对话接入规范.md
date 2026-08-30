# 任意 GPT 对话接入规范

## 目标

让新的 GPT 对话在不依赖旧聊天内容的情况下，通过同一个长期应用连接调用本机 Codex。

## 正式发现机制

ChatGPT 侧应安装/启用一个固定应用名称：

`亚马逊智能体 Codex 执行器`

该应用暴露 MCP 工具。只要该应用在账户/工作空间中保持启用，新对话即可发现其工具。

## 建议工具面

第一阶段至少暴露：

- `codex_status`：查看 Gateway / Codex 状态；
- `codex_start_task`：创建 Codex 任务；
- `codex_continue_task`：继续现有任务；
- `codex_get_task`：查询任务状态；
- `codex_cancel_task`：停止任务；
- `codex_list_projects`：查看已授权工程；
- `codex_read_result`：读取任务最终结果；
- `codex_run_command`：在授权根目录中执行命令；
- `codex_apply_changes`：让 Codex 修改工程；
- `codex_use_secret`：按 Secret ID 使用本机凭证，但不返回明文。

## 新对话行为

当用户说“让 Codex 执行”“让 Codex 施工”“直接交给 Codex”“调用 Codex”等，应优先调用本应用，而不是要求用户打开 Codex 窗口复制粘贴。

若应用已经连接：

```text
GPT → codex_status → ONLINE
               ↓
         codex_start_task
               ↓
            Codex执行
```

不要求创建 GitHub Issue，不要求读取 AACC。

## 长期认证

推荐 OAuth 2.0 / OIDC：

- Authorization Code + PKCE；
- 请求长期/离线访问能力；
- 签发 refresh token；
- access token 短期；
- refresh token 可轮换；
- Gateway 不把 token 返回给 GPT。

首次完成授权后，正常跨对话调用依赖 refresh token 自动续期。

## 权限体验目标

本工程自身不为每一个文件修改、命令、构建、Git 操作重复弹出确认。

默认将日常工程执行作为一个长期授权能力：

`CODEX_HIGH_AUTHORITY_EXECUTION`

如果 ChatGPT 平台本身针对某些写操作要求确认，应遵循平台要求；Gateway 不通过伪造、绕过或禁用平台认证来消除确认。

## 账户边界

“任意 GPT 对话”不表示互联网上任何 GPT 都能连接。它表示：**任何拥有此已批准应用使用权的 GPT 对话**都可调用。

严禁无认证公网暴露一个可执行任意命令的接口。
