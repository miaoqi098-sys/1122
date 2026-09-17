# GitHub 受控任务桥｜Codex 自动执行模式

## 当前目标

GitHub 作为 GPT 与本机 Codex 之间的受控任务邮箱；本机 Bridge Worker 负责自动领取任务并通过 GPT-Codex Gateway 启动 Codex。

## 权威链路

```text
GPT
  ↓ 写入结构化任务 + 任务规格
GitHub `codex-dispatch`
  `.codex-bridge/inbox/current.json`
  `.codex-bridge/tasks/<task_id>.md`
  ↓ 每 30 秒自动领取
AmazonAgent-Controlled-Codex-Bridge
  ↓
GPT-Codex Gateway (127.0.0.1:8765)
  ↓ codex_start_task
本机 Codex
  ↓
创建 `codex/*` 工作分支 → 修改代码 → 测试 → commit → push → PR
  ↓
Bridge 写回
`.codex-bridge/results/<task_id>.json`
  ↓
GPT 读取结果并验收
```

## 支持的任务类型

### `local_readonly_test`

只读检查本机 `C:\AmazonAgent`，用于验证整条链路。

### `website_online`

保留的受控网站上线任务，仅允许预定义域名参数。

### `engineering_task`

用于受控工程开发。远程任务文件不能携带任意 `prompt`、`command`、`shell` 或凭据，只能提供：

- `spec_path`：必须位于 `.codex-bridge/tasks/`；
- `work_branch`：必须以 `codex/` 开头；
- `base_branch`：固定为 `main`。

Codex 从 `origin/codex-dispatch:<spec_path>` 读取完整工程规格，然后在独立工作分支中开发、测试、提交、推送并创建 PR。Codex 不得自动 merge、force-push、修改 GitHub Secrets 或绕过仓库保护。

## GPT 的职责

1. 生成唯一 `task_id`；
2. 将工程规格写入 `codex-dispatch/.codex-bridge/tasks/<task_id>.md`；
3. 将结构化任务写入 `codex-dispatch/.codex-bridge/inbox/current.json`；
4. 不向任务/结果文件写入凭证明文；
5. 读取 `.codex-bridge/results/<task_id>.json`；
6. 验收 Codex 创建的分支、测试与 PR。

## Worker 的职责

1. 每 30 秒检查 `codex-dispatch` inbox；
2. 校验任务类型、参数、路径和分支；
3. 自动恢复本机 GPT-Codex Gateway；
4. 调用 `codex_start_task`；
5. 轮询 `codex_read_result` 直到终态或超时；
6. 将结果写回 `.codex-bridge/results/<task_id>.json`；
7. 使用本地 state 防止重复执行同一 `task_id`。

## 安装/更新本机 Worker

使用：

```powershell
powershell -ExecutionPolicy Bypass -File "C:\AmazonAgent\对外连接板块\01_GPT链接Codex\09_GitHub任务桥\install-bridge.ps1"
```

Installer 会：

- 检查 Gateway 是否 ONLINE；
- 检查本机 `gh` 已授权且可以访问 `miaoqi098-sys/1122` 的 `codex-dispatch`；
- 将最新版 `worker.py` 复制到本机 Gateway 运行目录；
- 注册/覆盖 Windows 计划任务 `AmazonAgent-Controlled-Codex-Bridge`；
- 立即启动 Worker，并在以后登录时自动启动。

## 结果格式

```json
{
  "task_id": "...",
  "task_type": "engineering_task",
  "status": "SUCCEEDED",
  "completed_at": "ISO-8601 timestamp",
  "summary": "implementation/test/PR result",
  "local_codex_task_id": "..."
}
```

常见终态：`SUCCEEDED`、`FAILED`、`AUTH_REQUIRED`、`TIMEOUT`、`CANCELLED`。

## 安全边界

不得把 Token、Secret、Password、Cookie、Authorization Header 或其他凭证明文写入 GitHub 任务/结果。工程任务不能携带任意远程 shell；执行指令由 Worker 的可信模板生成，业务开发内容仅从受控 spec 文件读取。
