# 单产品纵向 MVP UI 回写映射 V0

## 1. 首页“今日经营概览”
来源：MetricSnapshot / OperatingSnapshot。
展示销售、广告花费、估算利润时必须保留 freshness/更新时间。

## 2. 首页“今日需要我处理”
来源：TaskCenter → HumanTaskView。
本 MVP 在 Approval requested + HumanActionRequest open 时出现；用户处理后从待处理列表移出，但任务/审批历史保留。

## 3. 首页“Agent今日动态”
来源：AgentActivity。
本 MVP至少产生：
- 广告异常发现；
- Agent-1 FinalDecision；
- Task 创建；
- Action 完成；
- Validation 完成。

## 4. 首页“产品经营状态与今日操作”
来源：ProductStateAggregator → ProductStatusCardView。
- 当前阶段：ProductStage；
- 当前目标：Goal；
- 今日操作数量/refs：Action；
- 当前任务：TaskCenter；
- 当前状态：BusinessState；
- 最近总结：StageSummary。

## 5. 首页“重点异常与机会”
来源：Canonical Event / ProcessedEvent 业务投影。
广告异常在未解决/仍观察时显示；Task完成不自动让异常消失。

## 6. 点击产品
点击 product_id 对应卡片进入完整 ProductStatusCardView；再通过 refs 进入 Task/Event/Action/Memory 详情。

## 7. 一致性要求
首页和产品详情不得各自计算同一业务事实；必须共享同一源对象/聚合器，允许展示字段不同，不允许事实结论互相矛盾。