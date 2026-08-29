# Agent-1 自主循环

## 1. 模块定位
`自主循环/` 用于描述 Agent-1 如何把一次经营观察持续推进为标准事件、决策、任务、执行验证和学习，并在有新证据时再次进入下一轮。

它不是一套独立于 `工作流/` 的第二条业务链，也不重新定义新的业务对象。所有阶段必须复用当前 canonical 链：

`Event → ContextPackage → DecisionItem → Option → RiskAssessment → FinalDecision → Task/TaskPlan → ExecutionResult → ValidationResult → LearningRecord`

## 2. 六阶段映射
- `01_观察`：发现变化并形成/更新标准Event，进入S01。
- `02_思考`：对应S02/S03及DecisionItemBuilder，形成可被排序的DecisionItem，不直接下最终决策。
- `03_计划`：对应S04/S05/S06/DecisionSelector，形成FinalDecision或正式非执行路由。
- `04_行动`：对应S07任务编排与审批/执行等待，不伪造真实执行结果。
- `05_验证`：只在取得真实ExecutionResult后进入S08，形成ValidationResult。
- `06_学习`：对应S09，形成LearningRecord与memory_writes plan，真实写入由R10完成。

## 3. S10 横向控制
自主循环不是“每轮必须完整跑完六阶段”。如果新决策会改变现有StrategyChain，必须按工作流规则触发S10；hold时循环停在观察/复核，不允许为了“完成一轮”硬生成反向Task。

## 4. 重入原则
新一轮应优先复用既有业务对象和策略链：
- 同一Event只是补证据时，更新/版本化而不是创建重复事件；
- blocked/approval解除后从resume_from恢复；
- ValidationResult触发新诊断时，从受影响阶段继续；
- 无新证据不得重复生成等价Decision/Task/LearningRecord。

## 5. 结束、休眠与唤醒
自主循环没有“永远忙碌”的要求。满足以下条件可进入等待：
- 没有新的有效Event；
- 当前策略仍在观察窗口；
- 需要审批/补证据/外部条件；
- 当前Decision/Task均已关闭且无新机会/风险；
- S10要求hold。

重新唤醒条件包括：新Event、新证据、review_trigger、stop_condition、approval结果、观察窗口结束、关键经营状态变化。

## 6. 运行边界
本模块只定义业务循环语义。真实自动触发、调度、工具/API执行、持久化分别依赖R01/R02/R07/R08/R09/R10/R11等运行能力。

## 7. 文件
- `01_观察.md`
- `02_思考.md`
- `03_计划.md`
- `04_行动.md`
- `05_验证.md`
- `06_学习.md`
- `防抖重入与停止.md`
- `示例与验收.md`
- `总验收记录.md`

## 8. 禁止
- 自主循环自创第二套Event/Decision/Task对象；
- 观察阶段直接下经营结论；
- 思考阶段越过S04-S06形成最终执行方案；
- 计划阶段直接创建真实执行结果；
- 行动阶段把“已创建Task”写成“已执行成功”；
- 验证阶段没有ExecutionResult就评价经营效果；
- 学习阶段把memory_writes plan伪装成真实已写入；
- 无新证据无限重复六阶段。