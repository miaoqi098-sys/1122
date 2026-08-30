# GitHub 任务桥｜GPT → Codex 跨对话任务投递

## 目标

当当前 ChatGPT 对话不能直接调用本机 Gateway 时，使用本仓库现有 GitHub 写权限作为受控任务投递层，把明确的工程任务交给本机 Codex Runtime。

## 链路

```text
已授权 GPT 对话
  ↓ 写入结构化任务文件
09_GitHub任务桥/tasks/
  ↓ 本机 Worker 读取
GPT-Codex Gateway
  ↓
Codex App Server
  ↓
Codex
  ↓
09_GitHub任务桥/results/
  ↓
GPT 读取结果并继续决策
```

## 任务文件

路径：`tasks/<task_id>.json`

```json
{
  "schema_version": "1.0",
  "task_id": "20260831-website-infra-001",
  "project_id": "amazon-agent",
  "conversation_id": "website-api-qualification",
  "action": "codex_start_task",
  "title": "检查官网部署基础设施",
  "instruction": "检查并完成 GPT 明确指定的工程操作；不得输出本机 Secret 明文。",
  "status": "PENDING"
}
```

第一版只允许：

- `codex_start_task`
- `codex_apply_changes`

不把任意 Shell 命令能力暴露到任务桥。

## 结果文件

路径：`results/<task_id>.json`

结果至少包括：任务编号、Gateway 任务编号、状态、结果摘要、错误、开始时间、完成时间。

## 安全边界

- 只接受本仓库固定目录中的结构化任务；
- 只接受 Gateway 已授权的工程 ID；
- 不接收或回传密码、Token、刷新令牌等明文凭证；
- 凭证只能由 Codex 在本机已配置环境中使用；
- 不开放匿名公网访问本机 Gateway；
- GPT 仍负责决策，Codex只执行 GPT 明确指定的操作。

## 新对话识别规则

新的 GPT 对话识别到本工程后，如需要 Codex 执行本机操作而当前对话没有直接 Gateway 工具，应使用本任务桥：创建任务文件，等待本机 Worker 处理，然后读取对应结果文件继续工作。

## 当前状态

- 本机 Gateway / Codex Runtime：已验证；
- 任务桥协议：已建立；
- 本机 Worker：待安装与验收；
- 跨对话自动任务投递：Worker 验收后成立。
