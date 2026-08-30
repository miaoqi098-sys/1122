# AgentActivity 与 Memory 实现任务包 V1

> 覆盖：R-GP-019、R-GP-020

## 1. AgentActivity Generator
业务活动不由模型随意写日志，而由结构化对象变化触发，例如：
- Event created/updated/resolved；
- FinalDecision created；
- Task created；
- Goal switched；
- Action executed；
- Validation completed。

自然语言摘要可以模板化/模型化，但事实引用必须先存在。

## 2. AgentActivity Repository
至少支持：
- append；
- query by product/agent/date；
- importance/visibility；
- duplicate aggregation；
- source object refs；
- UI首页今日动态查询。

EngineeringLog 与 AgentActivity 分开保存。

## 3. Memory Repository
Memory采用追加式保存，至少区分：
- fact/history；
- decision rationale reference；
- learning/strategy outcome；
- stage summary reference。

不得存储私有链式思考；只保存可审计业务理由、证据引用和结论。

## 4. Timeline
按 product_id 建立统一时间线：Metric/Event/Decision/Task/Action/Validation/Goal/Stage/Memory引用。

Timeline是索引，不替代源对象事实。

## 5. StageSummary Generator
输入：阶段时间窗口内的结构化历史对象。
输出：StageSummary + source_refs。
摘要不能覆盖底层历史，且必须能解释“这一阶段做了什么、结果如何、留下什么结论”。

## 6. 失败路径
- source object不存在 → reject activity/memory write
- summary证据不足 → incomplete
- 重复Activity → aggregate/deduplicate
- stale summary → 标记 outdated 并重建，不覆盖旧版本

## 7. 验收条件
- 首页Agent动态不读取工程debug日志；
- Memory可回查来源对象；
- 阶段摘要可追溯；
- 同产品时间线可按时间排序；
- Agent-1/专业Agent不各自维护互不兼容的历史库。

## 8. 静态L1
业务活动、记忆、时间线和阶段摘要的运行职责已明确。未实现Repository。L1：PASS。