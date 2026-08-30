# Codex App Server 适配规范

## 主执行器

长期主执行器固定优先采用 `Codex App Server`。

原因：它是长期进程、双向消息协议，可以保留 thread、持续接收事件，并允许客户端在 Codex 请求额外输入或审批时继续同一个 turn。

## Gateway职责

Gateway负责：

1. 启动并监管 Codex App Server；
2. 建立 JSONL / stdio 双向会话；
3. 为每个项目维护 thread 映射；
4. 把 GPT 工具调用转换为 App Server 请求；
5. 把 Codex 事件流标准化成 MCP tool result / progress；
6. 处理取消、超时、恢复；
7. 不把 Codex 的本地凭证或系统 Secret 返回给 GPT；
8. App Server 崩溃后自动重启并尽可能恢复任务。

## Thread映射

```text
project_id
  └── project_thread
       ├── conversation_A child thread
       ├── conversation_B child thread
       └── conversation_C child thread
```

项目级上下文长期保留；每个 GPT 对话使用独立 child thread，防止不同对话互相污染临时上下文。

## 工具调用映射

- `codex_start_task` → 新建/选择 thread → submit turn；
- `codex_continue_task` → 同一 thread 新 turn；
- `codex_get_task` → Gateway task ledger + App Server state；
- `codex_cancel_task` → cancel current turn；
- `codex_run_command` → 通过 Codex 任务执行，不向 GPT 暴露一个匿名公网 shell；
- `codex_apply_changes` → Codex 在授权工程根目录中完成文件修改与验证。

## 权限

Gateway对 Codex 采用高权限配置，但必须绑定到已授权工程根目录和本机账户权限。默认不重复增加人工审批。

如果 Codex/App Server 自身返回 approval request：

- 可逆工程操作：Gateway依据 `HIGH_AUTHORITY` 策略自动批准；
- 命中少数硬门槛动作：转为人工确认；
- 无法分类：fail closed，不猜测。

## 备用执行器

当 App Server 不可用：

1. 优先 Codex SDK；
2. 再降级到 `codex exec`；
3. 降级不改变 Secret 边界和权限策略。

`codex exec` 只用于恢复/降级，不作为长期主通道。

## 验收

必须证明：

- App Server 可启动；
- 可创建 thread；
- 可执行真实文件修改；
- 事件可实时回传；
- 可继续同一 thread；
- 可取消任务；
- Gateway重启后任务/项目映射可恢复；
- 新 GPT 对话可创建新的 child thread；
- 不经过 AACC / GitHub Issue。
