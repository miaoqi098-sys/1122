# Approval 工作流实现任务包 V1

> 覆盖：R-GP-016（审批部分）

## 1. 目标
把“用户点了批准”变成独立、可审计、可校验的 Approval 事实，而不是直接触发执行。

## 2. 审批输入
- task_id
- human_action_request_id
- approver identity
- requested decision
- scope
- current task version
- current policy/authority result

## 3. 审批输出
- approval_id
- decision: approved/rejected
- decided_at
- approver_id
- scope
- reason/note
- policy_version
- task_version
- expires_at（如适用）

## 4. 并发与防重放
- 同一request只允许一个有效最终审批；
- task版本变化后旧审批不得直接授权新版本任务；
- approval scope与执行scope必须完全匹配；
- 过期审批不可执行。

## 5. 拒绝路径
拒绝后：
- Task进入合法拒绝/取消/待重规划状态；
- 形成AgentActivity；
- 不自动重试同一Action方案；
- 新方案必须产生新的Option/Decision/Task引用链。

## 6. 批准后
批准只把Task推进到“具备进入执行前检查资格”的状态；M1-B Executor仍需重新执行Policy/Permission检查。

## 7. 验收条件
- 双击/重复请求不会产生双审批；
- rejected无法进入execution；
- expired approval fail closed；
- 所有Approval可回查用户、政策版本、任务版本和scope；
- Approval不包含Executor副作用。

## 8. 静态L1
审批事实、并发、防重放、拒绝和批准后边界已明确。L1：PASS。