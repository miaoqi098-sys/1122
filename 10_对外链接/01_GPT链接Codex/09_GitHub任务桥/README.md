# GitHub 受控任务桥｜Codex 主动执行模式

## 当前目标

GitHub 只作为 GPT 与本机 Codex 之间的受控任务邮箱。

当前主线路不再依赖常驻 Worker 轮询，也不要求 Gateway 作为任务领取中枢。

## 权威链路

```text
GPT
  ↓ 发布任务
GitHub `codex-dispatch`
`.codex-bridge/inbox/current.json`
  ↓
Codex 主动领取
  ↓
Codex 本机执行
  ↓
Codex 自己写回
`.codex-bridge/results/<task_id>.json`
  ↓
GPT 读取结果
```

## GPT 的职责

GPT 只负责：

1. 生成唯一 `task_id`；
2. 把结构化任务写入 `codex-dispatch`；
3. 不向任务文件写入凭证明文；
4. 等 Codex 回写结果；
5. 读取并验收结果；
6. 根据结果继续下达下一任务。

GPT 不负责本地领取、不替代 Codex 执行本机命令。

## Codex 的职责

当用户要求“领取 GitHub 内任务并执行”时，Codex负责完整闭环：

1. 使用本机 `gh` 已授权会话读取：
   `.codex-bridge/inbox/current.json`
2. 读取 `task_id`、`task_type`、参数和任务说明。
3. 检查是否已存在：
   `.codex-bridge/results/<task_id>.json`
   若已存在终态结果，不得重复执行。
4. 在本机执行任务。
5. 所有交互式外部操作必须有超时；不得无限等待。
6. 如果缺少授权，返回 `AUTH_REQUIRED`；如果失败，返回 `FAILED`；如果超时，返回 `TIMEOUT`。
7. 将结果直接提交到 `codex-dispatch`：
   `.codex-bridge/results/<task_id>.json`
8. 回写完成后向本机用户报告任务 ID 与最终状态。

## 结果格式

```json
{
  "task_id": "...",
  "task_type": "...",
  "status": "SUCCEEDED",
  "completed_at": "ISO-8601 timestamp",
  "summary": "concise execution result"
}
```

允许的终态至少包括：

- `SUCCEEDED`
- `FAILED`
- `AUTH_REQUIRED`
- `TIMEOUT`
- `CANCELLED`

不得把 Token、Secret、Password、Cookie、Authorization Header 或其他凭证明文写入结果。

## 本地敏感信息

如果任务需要 Cloudflare、R2、Amazon API 或其他本机凭证，Codex只允许调用本地敏感信息机制。凭证本体不得经过 GitHub 任务文件或结果文件。

## Worker / Gateway 状态

目录中的 `worker.py`、`install-bridge.ps1`、Gateway Runtime 等代码保留作历史实现与故障恢复备用。

当前主线路默认：

```text
Codex 自己领取 GitHub 任务
Codex 自己执行
Codex 自己回写 GitHub
```

除非后续明确重新启用，不再把 Worker 轮询视为必需组件。
