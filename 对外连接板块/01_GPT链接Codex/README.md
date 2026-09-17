# GPT ↔ Codex 唯一主链路

本目录只保留一条生产主线：

```text
GPT
  ↓
GitHub codex-dispatch
  ↓
本机 Bridge Worker 自动领取
  ↓
GPT-Codex Gateway (127.0.0.1:8765)
  ↓
本机 Codex
  ↓
codex/* 工作分支 → 测试 → commit → push → PR
  ↓
结果回写 .codex-bridge/results/<task_id>.json
  ↓
GPT 验收
```

## 目录职责

- `03_本地网关/`：本机 Gateway Runtime，负责把受控任务交给 Codex。
- `09_GitHub任务桥/`：GitHub 任务邮箱 + 本机 Worker，负责自动领取、校验、调用 Gateway、回写结果。

## 唯一任务模式

生产开发任务统一使用 `engineering_task`。

任务只允许包含：
- `task_id`
- `task_type=engineering_task`
- `created_at`
- `parameters.spec_path`
- `parameters.work_branch`
- `parameters.base_branch=main`

其中：
- `spec_path` 必须位于 `.codex-bridge/tasks/`；
- `work_branch` 必须以 `codex/` 开头；
- 不允许远程传入 `prompt`、`command`、`shell`、`powershell`、凭据或 Secrets；
- 不允许 Codex 自动 merge、force-push、修改 GitHub Secrets 或绕过仓库保护。

## 本机更新/安装

```powershell
powershell -ExecutionPolicy Bypass -File "C:\AmazonAgent\对外连接板块\01_GPT链接Codex\09_GitHub任务桥\install-bridge.ps1"
```

该脚本负责：
1. 检查 Gateway 是否 ONLINE；
2. 检查本机 GitHub CLI 已授权 `miaoqi098-sys/1122`；
3. 安装最新版 Worker；
4. 注册/覆盖 `AmazonAgent-Controlled-Codex-Bridge` 计划任务；
5. 立即启动自动任务领取。

## 废弃规则

以下模式不再作为生产主线：
- 手动要求 Codex “主动领取任务”；
- 旧目录 `10_对外链接/...`；
- 仓库目标 `miaoqi098-sys/-`；
- GitHub Issue 轮询；
- 任意远程 Shell/Prompt 执行；
- 多套并行 Gateway/Bridge 规则。

如果后续需要新增能力，应扩展当前受控 `engineering_task` 协议，而不是再建立第二套桥。
