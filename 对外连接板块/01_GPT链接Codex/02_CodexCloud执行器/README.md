# Codex Cloud 执行器

这里不是常驻服务，也不运行任何本机进程。

`dispatch.py` 由 GitHub Actions 在 `codex-dispatch` 分支收到新任务时启动。它负责：

1. 读取 `.codex-cloud/inbox/current.json`；
2. 校验固定仓库、`main` 基线、`codex/*` 工作分支和受控 spec 路径；
3. 读取任务规格；
4. 创建 OpenAI Agents API session；
5. 使用 OpenAI-hosted environment 克隆 `miaoqi098-sys/1122`；
6. 将本次 Actions 的短期 `GITHUB_TOKEN` 作为 session 环境变量提供给 Codex，用于 branch / push / PR；
7. 等待 session 进入终态；
8. 验证工作分支和 PR 是否真实存在；
9. 输出不含凭据的结果 JSON。

## 为什么不使用 Cloudflare Dispatcher

Cloudflare 是1122生产运行基础设施，不需要承担开发任务调度。把它插入 GPT→Codex 链会额外增加 Worker、鉴权 Secret 和状态转发，因此此链路刻意只保留 GitHub Actions + OpenAI Agents API。

## 运行凭据

- `OPENAI_API_KEY`：GitHub Actions Secret；
- `GITHUB_TOKEN`：GitHub Actions 自动生成，只在当前 job 内有效。

禁止创建长期 GitHub PAT 作为默认实现。

## 结果判定

只有同时满足以下条件，工程任务才算 `SUCCEEDED`：

- Agents session 正常结束；
- `codex/*` 工作分支真实存在；
- 对 `main` 的 PR 真实存在。

否则写回 `FAILED` / `TIMEOUT` / `REQUIRES_ACTION`。
