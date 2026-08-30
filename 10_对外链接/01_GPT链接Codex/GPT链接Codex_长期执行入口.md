# GPT 链接 Codex｜长期执行入口 V1

> 正式归属：`10_对外链接/01_GPT链接Codex/`
>
> 目标：让未来新的 GPT 对话在具备 GitHub 访问能力时，可以通过固定、可审计、长期存在的控制链驱动 NODE-001 上的 Codex 执行开发任务，而不依赖当前聊天上下文。

## 1. 永久控制链

正式控制链固定为：

```text
GPT 对话
  ↓
GitHub（持久控制面）
  ↓
参考执行仓库：miaoqi098-sys/amazon-agent-command-center
  ├─ [AACC-CODEX] Issue
  │    ↓
  │  CodexBridge
  │    ↓
  │  NODE-001
  │    ↓
  │  codex exec
  │    ↓
  │  独立 worktree → 校验 → 测试 → Commit → Push → PR → Evidence
  │
  └─ [AACC-LOCALOPS] Issue
       ↓
     LocalOps
       ↓
     NODE-001 固定白名单本地操作
```

本文件不是“ChatGPT 原生 Codex 工具”的替代声明；它定义的是已经由 AACC 建立的 GitHub → NODE-001 → Codex 长期执行桥。

## 2. 任意新 GPT 对话的启动规则

任何新的 GPT 对话，只要用户要求“调用 Codex、让 Codex 执行、让 Codex 施工、让 Codex 修改工程、让 Codex 在本地执行”等等，应按以下顺序处理：

1. 读取本文件。
2. fresh-read `miaoqi098-sys/amazon-agent-command-center` 当前状态，不得用旧聊天记忆替代。
3. 验证 CodexBridge / LocalOps 的最新可用状态；若需要本地状态证据，先走 LocalOps 固定动作获取。
4. 根据任务性质选择执行通道：
   - 开发/代码/测试/Git 工程任务 → `[AACC-CODEX]`。
   - NODE-001 固定维护/部署/健康检查 → `[AACC-LOCALOPS]`。
5. 创建符合契约的 GitHub Issue。
6. 观察 Issue 状态与回传 Evidence，直到 `WAITING_REVIEW`、`BLOCKED_*` 或终态。
7. 若需要返工，使用正式 Reviewer 命令；不得通过重复新建任务形成盲重试。

若当前 GPT 对话没有 GitHub 写权限或相关连接不可用，必须明确说明“当前无法投递执行任务”，不得伪造 Codex 已被调用。

## 3. `[AACC-CODEX]` 正式任务契约

目标仓库：

```text
miaoqi098-sys/amazon-agent-command-center
```

标题必须以：

```text
[AACC-CODEX]
```

开头。

Issue 正文最少必须包含：

```text
TASK_ID: <唯一任务编号>

GOAL:
<明确目标>

ALLOWED_SCOPE:
- <允许修改的路径/**>

ACCEPTANCE:
- <验收条件1>
- <验收条件2>
- <验收条件3>
```

GPT 在创建任务时必须：

- 使用唯一 `TASK_ID`；
- 尽量缩小 `ALLOWED_SCOPE`；
- 给出可验证的 `ACCEPTANCE`；
- 不把密码、Token、Client Secret、Refresh Token、银行卡、身份证件等写入 Issue；
- 不授权 force push、自动 Merge、删除 main、修改仓库可见性等高风险行为；
- 不绕过 AACC 的 Secret、审批、作用域、Git 与 Reviewer 边界。

## 4. CodexBridge 已接受的执行模型

AACC CodexBridge 的长期开发执行模型是：

```text
GitHub Issue
→ 领取任务
→ 独立 Git worktree
→ codex exec 非交互执行
→ 作用域检查
→ Secret 特征扫描
→ 测试 / 健康检查
→ Commit
→ Push
→ 创建或更新 PR
→ Issue 回传 Evidence
→ WAITING_REVIEW
```

GPT 不应要求 Codex 自己 Commit / Push / 创建 PR；这些动作由 Bridge 负责。

## 5. Reviewer 命令

返工：

```text
AACC_REVIEW_COMMAND: REWORK
TASK_ID: <TASK_ID>
INSTRUCTION: <具体返工要求>
```

通过登记：

```text
AACC_REVIEW_COMMAND: APPROVED
TASK_ID: <TASK_ID>
```

阻塞：

```text
AACC_REVIEW_COMMAND: BLOCKED
TASK_ID: <TASK_ID>
INSTRUCTION: <阻塞原因或恢复条件>
```

`APPROVED` 只表示 Reviewer 状态，不等于自动合并 `main`，也不自动获得 Amazon / Ads 写权限。

## 6. `[AACC-LOCALOPS]` 长期本地控制通道

LocalOps 与 CodexBridge 独立。Codex 不可用时，LocalOps 仍可通过 GitHub Issue 执行固定白名单动作。

标题必须以：

```text
[AACC-LOCALOPS]
```

开头。

正文必须是满足 AACC `localops-request.schema.json` 的单一 JSON 对象。

适合用途包括：

- NODE 状态读取；
- Git fetch；
- CodexBridge 重启；
- CodexBridge 健康检查；
- Codex 最小探针；
- 调度器状态；
- GitHub 网络探针；
- 受控部署；
- 其他已经进入 LocalOps allowlist 的固定动作。

禁止把任意 PowerShell、Shell 命令、任意 URL、任意可执行文件路径或 Secret 作为自由参数塞进 LocalOps 请求。

## 7. 长期跨对话发现机制

本仓库根 `README.md` 应长期保留对本文件的入口引用。

新 GPT 对话只要能读取本仓库，就可以通过：

```text
README.md
→ 10_对外链接/01_GPT链接Codex/GPT链接Codex_长期执行入口.md
→ AACC fresh-state
→ GitHub Issue
→ CodexBridge / LocalOps
```

恢复这条执行链。

因此 GitHub 是跨聊天窗口的持久控制面，聊天历史不是执行链的唯一记忆来源。

## 8. 安全边界

### Secret

真实 Secret 永远不得写入：

- ChatGPT 对话；
- GitHub Issue / PR / Commit；
- README；
- 普通日志；
- 测试夹具；
- Codex Prompt。

Secret 应只保存在 NODE-001 受保护的本地 Secret Store / DPAPI / Credential Vault 或经批准的等价存储中。Agent / Codex 原则上只能“使用 Secret”，默认不能“查看 Secret”。

### 外部平台写操作

本执行入口只建立“GPT 驱动 Codex / LocalOps”的工程控制能力，不自动授予：

- Amazon SP-API 写操作；
- Amazon Ads 广告修改；
- 财务 / 付款；
- 权限修改；
- 删除资源；
- Cloudflare 高风险账户动作；
- 任何需要人工二次验证的操作。

这些能力必须遵守各自独立的权限矩阵和审批门槛。

## 9. 真值状态

必须区分：

```text
入口文件存在
≠ CodexBridge 当前在线

CodexBridge 当前在线
≠ Codex 本次任务执行成功

代码 / CI 通过
≠ NODE Runtime 已部署

凭证存在
≠ AUTH_VERIFIED

AUTH_VERIFIED
≠ READ_VERIFIED

READ_VERIFIED
≠ LIVE_DATA_VERIFIED
```

任何新 GPT 对话都必须基于 fresh evidence 判断当前状态。

## 10. 长期维护规则

- 本文件是总工程的 GPT→Codex 长期入口，不因单次任务完成而删除。
- AACC 执行协议若升级，应更新本文件版本与机器配置文件，而不是另建平行执行链。
- 优先复用 AACC `CodexBridge` / `LocalOps`，避免再次建设第二套重复的本地执行 Runtime。
- 如果未来接入 Codex SDK / Codex App Server，可把它们作为该入口的 V2/V3 执行适配器，但必须继续保留权限、审计、任务状态、Secret、人工审批和 Evidence 边界。

## 11. 当前参考实现

参考仓库：

```text
miaoqi098-sys/amazon-agent-command-center
```

关键参考路径：

```text
03_NodeRuntime/CodexBridge/
03_NodeRuntime/LocalOps/
```

本入口的长期目标只有一个：

> 用户只需要告诉 GPT “做什么”，GPT 负责形成受控任务；GitHub 负责长期记忆和投递；AACC 负责调度与安全边界；Codex / LocalOps 负责在 NODE-001 真正执行。