# Task + Approval + HumanActionRequest 规则 V1

## 1. 三对象边界
- Task：系统真正要推进的一项工作及其生命周期。
- Approval：某个 Task 是否获准进入受控执行的审批事实记录。
- HumanActionRequest：解释为什么某件事必须由人工介入，并承载首页“今日需要我处理”的可操作请求。

三者不得合并成一个自然语言任务字段。

## 2. 与 Agent-1 边界
Agent-1 负责 FinalDecision 后的任务编排、优先级与冲突处理；系统级 Task Contract 负责让任务可被 TaskCenter、UI、执行层、验证层共同引用。Approval/Permission 服务不得被 Agent-1 绕过。

## 3. 状态语义
Task 复用 Agent-1 已有核心生命周期，并补充首页/外部等待所需 `waiting_human`、`waiting_external`、`expired`。
`completed` 必须意味着规定验证已通过；Executor 返回 success 只能先产生 ExecutionResult，不得直接等同于业务完成。

## 4. 人工介入链
```text
FinalDecision
→ Task
→ Policy / Permission Check
├─ 可自动执行 → Execution
└─ 必须人工 → HumanActionRequest
                 ↓
             Approval（适用时）
                 ↓
             用户处理
                 ↓
             Execution
```

人工请求可以只是补信息/人工操作，并非都必须产生 Approval；但需要批准的任务必须存在 Approval 记录。

## 5. 拒绝与过期
Approval rejected/expired 不得删除 Task；Task 应根据编排规则转 blocked/cancelled/重新规划，并保留原因和审计链。

## 6. 产品关联
产品级 Task/HumanActionRequest/Approval 应携带 `product_id`；ASIN/SKU 不作为跨模块主引用。

## 7. 首页查询
“今日需要我处理”应主要查询：
- Task.requires_human=true 或 status=waiting_human/pending_approval；
- 对应未解决 HumanActionRequest；
- 对应 Approval 当前状态；
并按统一 Priority Contract 排序。

## 8. 运行依赖
Task Repository、状态机服务、TaskCenter、权限检查、真实审批动作、Scheduler/Executor 属于后续运行建设。