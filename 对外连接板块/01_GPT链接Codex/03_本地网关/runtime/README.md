# GPT-Codex Gateway Runtime

本目录只负责一件事：在本机提供 `127.0.0.1:8765` Gateway，把受控 Bridge 任务交给本机 Codex。

## 运行接口

- Health: `http://127.0.0.1:8765/health`
- MCP: `http://127.0.0.1:8765/mcp/`

## 安装

不要在 `runtime/` 内手工维护另一套启动方式。统一从上一级执行：

```powershell
powershell -ExecutionPolicy Bypass -File "C:\AmazonAgent\对外连接板块\01_GPT链接Codex\03_本地网关\install-gateway.ps1" -ProjectRoot "C:\AmazonAgent"
```

卸载：

```powershell
powershell -ExecutionPolicy Bypass -File "C:\AmazonAgent\对外连接板块\01_GPT链接Codex\03_本地网关\uninstall-gateway.ps1"
```

## 运行边界

- 只监听 localhost；
- 只允许配置过的项目根目录；
- 凭据不得进入 Git、任务文件或结果文件；
- Gateway 只提供执行能力，任务来源和任务校验由 `09_GitHub任务桥` 负责；
- 不在这里再建立第二套任务队列、GitHub Issue 轮询或远程公网入口。

## 验收

只有以下三项同时成立才视为 Gateway 可用：

1. `/health` 返回 ONLINE；
2. Bridge 能调用 `codex_start_task`；
3. Codex 能完成一次受控任务并返回终态结果。
