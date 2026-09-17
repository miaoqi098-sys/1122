# GPT → Codex Cloud｜唯一主线

本目录只维护一条开发执行链：

```text
ChatGPT
  ↓ 写入结构化工程任务
GitHub `codex-dispatch`
  ↓ push 触发
GitHub Actions
  ↓
OpenAI Agents API
  ↓ OpenAI-hosted environment + Codex harness
Codex Cloud
  ↓
`codex/*` 分支 → 测试 → commit → push → PR
  ↓
GitHub Actions 写回 `.codex-cloud/results/<task_id>.json`
  ↓
ChatGPT 读取 PR / 结果并做业务验收
  ↓
人工 Merge
```

## 已废弃

以下组件不再属于1122：

- Windows 计划任务；
- `C:\AmazonAgent` 本机执行依赖；
- `127.0.0.1:8765` 本地 Gateway；
- 本机 Codex CLI / app-server；
- 本机 Bridge Worker；
- `.codex-bridge` 任务协议。

Git 历史保留旧实现，需要审计时从历史提交查看，不在当前目录继续保留兼容代码。

## 目录

```text
01_GPT链接Codex/
├── README.md
├── 01_任务协议/
│   └── engineering-task.schema.json
├── 02_CodexCloud执行器/
│   ├── README.md
│   ├── dispatch.py
│   └── test_dispatch.py
└── 03_Codex规则/
    └── README.md
```

仓库根目录 `AGENTS.md` 是 Codex 工程行为的唯一权威规则。

## 两个真值来源

- **任务传输格式**：`01_任务协议/engineering-task.schema.json`
- **工程行为规则**：仓库根目录 `AGENTS.md`

不要再建立第二份 task schema、Gateway contract 或本机执行规则。

## 凭据

云执行只需要 GitHub Actions Secret：

- `OPENAI_API_KEY`：调用 OpenAI Agents API。

GitHub 写入使用 Actions 自动生成的短期 `GITHUB_TOKEN`，权限仅在该次 workflow job 内有效；不维护长期 GitHub PAT。

## 安全边界

- 任务文件不得携带 Token / Secret / Password；
- Codex 只能在 `codex/*` 分支工作；
- Codex 不得自动 merge；
- Codex 不得修改 GitHub Secrets；
- 默认不得修改业务规则，除非任务规格明确要求；
- PR 是工程交付边界，GPT负责业务验收，最终合并由人工完成。
