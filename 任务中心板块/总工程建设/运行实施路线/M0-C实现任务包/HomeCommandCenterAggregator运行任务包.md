# HomeCommandCenterAggregator 运行任务包 V1

> 覆盖：R-GP-022

## 1. 输入
- OperatingSnapshot
- HumanTaskView[]
- AgentActivity[]
- ProductStatusCardView[]
- ImportantEvent[]
- Navigation/Permission context

## 2. 输出
严格遵循现有 `HomeCommandCenterView.schema.json`。

## 3. 聚合原则
- 首页各区独立降级；
- 某个产品卡失败不能导致全首页失败；
- HumanTask只读取 requires_human=true / waiting_human 等满足首页条件的任务；
- AgentActivity按 importance/visibility 降噪；
- ImportantEvents与HumanTasks分离，不把“值得关注”自动当成“必须人工处理”；
- 每个区域带 freshness/degraded 信息。

## 4. 首页快照一致性
允许不同数据源存在时间差，但必须显式返回各区 `effective_at/freshness`。不能为了“看起来一致”而丢弃来源时间。

## 5. 缓存
未来缓存建议按区域和product集合分层，避免全首页单缓存键；权限变化必须触发相应缓存失效。

## 6. 验收条件
- 首页六区中的业务五区有结构化来源；导航单独由Module/Permission提供；
- 各区可独立降级；
- 不直接调用13个Agent拼自然语言；
- ProductStatusCardView可点击进入单品视角；
- 首页只读阶段不存在写操作入口的后端执行能力。

## 7. 静态L1
首页聚合运行职责、降级、时间和缓存语义已明确。L1：PASS。