# GPT 链接 Codex｜当前真实实现

## 目标

建立一条跨对话可复用的 GPT→Codex 执行链路。GPT 负责决策、任务拆解与 GitHub 任务发布；Codex 负责主动从 GitHub 领取任务、在本机执行并把结构化结果写回 GitHub；GPT 再读取结果继续决策。

## 当前权威链路

```text
GPT
  ↓ 写入 GitHub `codex-dispatch` 任务
GitHub `.codex-bridge/inbox/current.json`
  ↓
Codex 主动读取并领取任务
  ↓
Codex 在本机执行
  ↓
本地文件 / CLI / Git / 已授权 API / 本地敏感信息调用器
  ↓
Codex 将结构化结果写回 GitHub
`.codex-bridge/results/<task_id>.json`
  ↓
GPT 读取结果、验收并决定下一任务
```

## 职责分工

- GPT：总控、拆解任务、写入 GitHub 任务、读取结果、验收、继续决策。
- Codex：任务领取者 + 本地执行者 + 结果回写者。整段“领取→执行→回写”由 Codex 自己完成。
- GitHub：受控任务邮箱和结果交换层。
- 本机工具：仅供 Codex 按任务需要调用，包括 Git、CLI、Cloudflare/Wrangler、本地 Secret Loader 等。
- Gateway / Worker：保留为历史实现或备用恢复工具，不再作为当前主线路的必要中间层。

## 当前任务位置

任务分支：`codex-dispatch`

收件箱：

```text
.codex-bridge/inbox/current.json
```

结果目录：

```text
.codex-bridge/results/<task_id>.json
```

## Codex 固定执行原则

当用户对本机 Codex 说“领取 GitHub 内任务并执行”时，Codex应：

1. 使用本机已登录的 `gh` 会话访问 `miaoqi098-sys/-`。
2. 从 `codex-dispatch` 读取 `.codex-bridge/inbox/current.json`。
3. 校验 `task_id`、`task_type`、参数和安全边界。
4. 不重复执行已有对应结果文件的任务。
5. 在本机完成任务要求。
6. 不把 Token、Secret、密码、Cookie、密钥等写入 GitHub、终端报告或日志。
7. 将结果写入 `.codex-bridge/results/<task_id>.json`。
8. 结果至少包含：`task_id`、`task_type`、`status`、`completed_at`、`summary`。
9. 成功、失败、需要授权、超时都必须回写；不得无限保持 RUNNING。

## 当前状态

- GPT 可以直接修改 GitHub 任务邮箱：已验证。
- 本机 Codex 可以访问 GitHub：已验证。
- 本机 Codex 可以执行本地操作：已验证。
- 当前目标：验证“Codex 自主领取 → 本地执行 → 自主回写 → GPT 读取”的完整闭环。

## 旧实现说明

`03_本地网关/`、`07_运行与恢复/`、`09_GitHub任务桥/` 中可能仍保留 Gateway、Worker 和恢复代码，用于历史追踪与备用恢复；除非明确重新启用，它们不再定义当前主执行链路。
