# GitHub 受控任务桥

## 目标

在当前 ChatGPT 套餐不能直接调用本机 Full MCP 的情况下，为 GPT 与已经本机验证通过的 Codex Gateway 之间建立一个**受控、白名单化、可跨对话复用**的任务桥。

这不是任意远程 Shell。GPT 不能把任意命令直接送到本机执行。

## 链路

```text
GPT 对话
  ↓ 写入白名单任务
GitHub `codex-dispatch` 分支
  ↓ 本机 Worker 轮询
Controlled Codex Task Bridge
  ↓ 本机 MCP
GPT-Codex Gateway
  ↓
Codex App Server
  ↓
Codex
  ↓
本机工程 / 已授权平台工具
  ↓
结果写回 GitHub results/
  ↓
GPT 读取结果继续决策
```

## 当前 V1 允许的任务

仅有：

`website_online`

用途：将现有 `sorilo-uk.com` API 资质官网部署上线，处理 Cloudflare Pages、自定义域名、必要 DNS、HTTPS 与公网可访问性验证。

允许参数只有：

```json
{
  "domain": "sorilo-uk.com"
}
```

Worker 会拒绝未知任务类型、任意命令字段、Shell / PowerShell 字段、Token / Secret / Password / Credential 字段、非 `sorilo-uk.com` 域名以及远程传入的任意自由执行指令。

真正发送给 Codex 的执行说明由本机 Worker 内置可信模板生成。

## GitHub 分支

任务收发专用分支：`codex-dispatch`

固定收件箱：

`10_对外链接/01_GPT链接Codex/09_GitHub任务桥/inbox/current.json`

结果：

`10_对外链接/01_GPT链接Codex/09_GitHub任务桥/results/<task_id>.json`

GitHub `main` 不作为任务队列。

## 本机一次性安装

前提：

1. `C:\AmazonAgent` 已存在本仓库；
2. GPT-Codex Gateway 已安装并通过 `LOCAL_RUNTIME_VERIFIED`；
3. 准备一个 fine-grained GitHub token，仅授权仓库 `miaoqi098-sys/-`，权限只需 `Contents: Read and write`；
4. Token 不得发送到 ChatGPT，不得写入 GitHub，不得进入日志。

安装脚本已经简化：

- 自动定位 `worker.py`，避免 Windows PowerShell 5.1 中文路径乱码；
- 自动检查 Gateway `/health`；
- 如果尚未配置 Token，会在本机安全提示输入一次并保存到用户环境变量，不回显 Token；
- 自动验证 Token 能读取 `codex-dispatch`；
- 自动安装并启动 Windows 常驻 Worker。

安装命令：

```powershell
cd C:\AmazonAgent
git pull
powershell -ExecutionPolicy Bypass -File ".\10_对外链接\01_GPT链接Codex\09_GitHub任务桥\install-bridge.ps1"
```

安装后 Windows 计划任务：

`AmazonAgent-Controlled-Codex-Bridge`

Worker 每 30 秒检查一次 `codex-dispatch` 收件箱。

## 已投递的首个真实任务

- `task_id`: `20260830-website-online-001`
- `task_type`: `website_online`
- `domain`: `sorilo-uk.com`

Worker 安装并启动后会自动领取，无需用户再次复制 Codex 任务正文。

## 跨对话规则

未来新的 GPT 对话识别到本工程后，如果需要当前白名单中的本机能力，应直接由 GPT：

1. 创建唯一 `task_id`；
2. 更新 `codex-dispatch` 的 `inbox/current.json`；
3. 等待 Worker 执行；
4. 读取 `results/<task_id>.json`；
5. 根据结果继续工程决策。

不得把未实现的任务类型伪装成已可执行能力。

## 当前验收状态

- `LOCAL_RUNTIME_VERIFIED`：已完成；
- 任务桥源码：已实现；
- `codex-dispatch`：已建立；
- 第一条 `website_online`：已投递；
- Worker 本机安装：待执行；
- `CONTROLLED_BRIDGE_VERIFIED`：等待首次机器验收。
