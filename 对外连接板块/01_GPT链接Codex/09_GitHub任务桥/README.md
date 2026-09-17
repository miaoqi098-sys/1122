# GitHub 任务桥

本目录是 GPT ↔ 本机 Codex 的唯一任务入口。

## 唯一链路

```text
GPT
  ↓
codex-dispatch/.codex-bridge/inbox/current.json
  + .codex-bridge/tasks/<task_id>.md
  ↓
AmazonAgent-Controlled-Codex-Bridge
  ↓
GPT-Codex Gateway
  ↓
Codex
  ↓
codex/* 分支 → 测试 → commit → push → PR
  ↓
.codex-bridge/results/<task_id>.json
```

## 生产任务类型

只把 `engineering_task` 作为正常开发主线。

允许参数：

```json
{
  "spec_path": ".codex-bridge/tasks/<task_id>.md",
  "work_branch": "codex/<name>",
  "base_branch": "main"
}
```

禁止：
- 远程 `prompt`、`command`、`shell`、`powershell`；
- Token、Secret、Password、Cookie、Authorization Header；
- 自动 merge；
- force-push；
- 修改 GitHub Secrets；
- 非 `codex/*` 工作分支。

`local_readonly_test` 仅用于链路诊断，不作为业务开发方式。
`website_online` 为兼容保留任务，不作为主线开发协议。

## 本机安装/更新 Worker

```powershell
powershell -ExecutionPolicy Bypass -File "C:\AmazonAgent\对外连接板块\01_GPT链接Codex\09_GitHub任务桥\install-bridge.ps1"
```

Worker 每 30 秒检查 inbox，校验任务后调用 Gateway，完成后写回 results。

## 运行真值

真正的规则来源只有：
1. `worker.py` 的校验逻辑；
2. `test_worker.py` 的边界测试；
3. 顶层 `01_GPT链接Codex/README.md` 的链路说明。

本目录不再维护第二份 JSON 规则文件。
