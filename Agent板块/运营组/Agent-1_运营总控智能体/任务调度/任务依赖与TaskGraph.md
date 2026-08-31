# 任务依赖与 TaskGraph

## 1. 定位
TaskGraph描述同一TaskPlan内任务之间的先后、阻塞、并行与互斥关系。S07负责生成图，本规则约束图必须满足的静态条件。

## 2. 关系类型
- `depends_on`：当前Task必须等待指定Task满足完成条件。
- `blocks`：当前Task未完成前，指定Task不得ready/running。
- `parallel_with`：两Task可并行，但仍需分别满足各自审批/权限/资源条件。
- `mutex_with`：两Task不可同时running。

## 3. 依赖方向
`A depends_on B` 表示B是A的前置。不得同时无理由写成 `A depends_on B` 与 `B depends_on A`。

## 4. 循环检测
TaskGraph在进入调度前必须检查有向循环：
`A→B→C→A`。

发现循环时：
1. TaskPlan不得整体宣称ready；
2. 标记dependency_error；
3. 回到S07修订依赖；
4. 不由Scheduler自行猜测删除一条边。

## 5. mutex规则
mutex必须说明原因，例如：
- 同一广告实体不能同时执行相反竞价动作；
- 同一价格对象不能同时进入两个冲突促销变更；
- 同一Listing字段不能并发写入相互冲突内容。

互斥不等于低优先级任务永久取消；通常是等待、重排或因新Decision明确cancel/supersede。

## 6. parallel规则
parallel只表示业务上允许并行，不代表执行层一定有容量。真实并发能力由Scheduler/Executor未来判断。

## 7. required_controls与依赖
若FinalDecision要求控制措施，S07应把control/approval/monitoring等Task或条件放到执行Task前后正确位置。例如：
- approval task blocks execution task；
- budget-control task depends_on approval；
- monitoring task parallel_with execution后的观察；
- rollback task只在rollback trigger成立时激活。

## 8. 跨TaskPlan依赖
允许通过外部引用表达，但必须保留external_task_ref / source_decision_ref，不能把别的TaskPlan的任务复制成新的task_id制造重复历史。

## 9. 禁止
- 用Task数组顺序暗示依赖而不显式记录关系；
- Scheduler自行改变业务依赖；
- 发现循环后继续执行；
- 用mutex直接删除历史任务；
- 把parallel理解成必须同时启动。