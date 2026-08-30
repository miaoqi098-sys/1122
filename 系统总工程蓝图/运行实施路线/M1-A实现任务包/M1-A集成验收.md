# M1-A 任务 / 权限 / 审批集成验收 V1

## 1. 验收目标
确认 TaskCenter、Policy/Permission、Approval 和目标切换审计在未来实现后能够形成安全、可审计的“执行前控制面”。

## 2. 集成门禁
- [ ] Task状态迁移由事务状态机控制。
- [ ] HumanActionRequest可稳定生成首页HumanTaskView。
- [ ] read/recommend/create_task/approve/execute权限严格分离。
- [ ] Policy服务不可用时执行候选fail closed。
- [ ] Approval与Task版本和scope绑定。
- [ ] rejected/expired Approval不能进入执行。
- [ ] 批准后仍需执行前权限复核。
- [ ] 目标切换不会删除旧Goal或静默改写旧Task。
- [ ] 所有状态变化形成审计记录。
- [ ] M1-A没有真实Executor副作用。

## 3. 最小样例
```text
Event
→ FinalDecision
→ Task(waiting_human)
→ HumanActionRequest
→ Permission check(require_approval)
→ Approval(approved/rejected)
→ Task transition
```

若approved，最终状态只是“可进入M1-B执行前检查”，不是已执行。

## 4. 静态验收结论
M1-A 实现任务包 V1：**PASS（静态规格）**。

下一阶段进入 M1-B：Executor + ExecutionResult + Validation 实现任务包规格化。