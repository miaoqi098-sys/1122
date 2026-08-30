# M0-C 实现任务包 V1

> 覆盖：R-GP-021、R-GP-022、R-GP-025
> 目标：把 ProductStateAggregator、HomeCommandCenterAggregator 和只读 UI API 规格化为未来可实现的读模型服务。
> 边界：当前不实现真实服务、缓存、数据库或UI部署。

## 任务包
1. ProductStateAggregator运行任务包
2. HomeCommandCenterAggregator运行任务包
3. 只读UI接口任务包
4. M0-C集成验收

## 原则
- 聚合器只读，不产生经营事实。
- 源对象缺失时降级，不伪造值。
- UI只读取结构化View，不直接拼多个Agent自然语言。
- 所有返回值携带必要 freshness/degraded/maturity 信息。
