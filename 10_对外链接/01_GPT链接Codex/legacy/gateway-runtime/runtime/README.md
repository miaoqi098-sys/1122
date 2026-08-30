# GPT-Codex Gateway Runtime V0.1

这是 `01_GPT链接Codex` 的第一批真实运行代码，不依赖 AACC，也不使用 GitHub Issue 作为执行总线。

## 已实现

- Streamable HTTP MCP 服务；
- `/health` 本地健康端点；
- 常驻 Gateway 进程；
- 启动并监管 `codex app-server`；
- Codex App Server `initialize / initialized` 握手；
- `thread/start`、`thread/resume`、`turn/start`、`turn/interrupt`；
- SQLite 持久任务账本与 GPT 对话→Codex thread 映射；
- 项目根目录白名单；
- HIGH_AUTHORITY 默认：`approvalPolicy=never`、`sandbox=danger-full-access`；
- Secret 只按环境变量名引用，值不进入 MCP 参数、任务账本或 Git；
- Gateway 重启时把旧 RUNNING 任务标记为 UNKNOWN，禁止伪造仍在运行；
- MCP 工具：`codex_status`、`codex_start_task`、`codex_continue_task`、`codex_get_task`、`codex_cancel_task`、`codex_list_projects`、`codex_read_result`、`codex_run_command`、`codex_apply_changes`、`codex_use_secret`。

## 运行

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[test]"
copy config.example.json config.local.json
# 修改 config.local.json 中的真实工程根目录
.\.venv\Scripts\python.exe -m gpt_codex_gateway --config .\config.local.json
```

本地 MCP 地址：

```text
http://127.0.0.1:8765/mcp/
```

健康检查：

```text
http://127.0.0.1:8765/health
```

## 当前真值

`SOURCE_IMPLEMENTED` 不等于 `LOCAL_RUNTIME_VERIFIED`。

只有在 NODE 上真实安装、启动，并完成 `codex_status → codex_start_task → 真实文件修改 → 新对话再次调用` 后，才能升级为长期直连验证通过。

当前 V0.1 只监听 localhost。下一阶段才接入长期 OAuth + 安全远程通道，使 ChatGPT 的不同对话可以复用同一应用授权访问这个 Gateway。
