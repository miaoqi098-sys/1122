# ProductStateAggregator V0

> 定位：把一个产品分散在数据、状态、目标、事件、任务、执行、验证、记忆中的结构化结果汇聚成统一产品状态读模型。

## 1. 输入
- ProductIdentity
- MetricSnapshot
- BusinessState
- ProductStage
- Goal
- Important Event / ProcessedEvent
- TaskCenter 产品级当前任务
- Action / ExecutionResult
- StageSummary / Memory

## 2. 输出
唯一主要输出：`ProductStatusCardView`。

## 3. 核心职责
- 按 product_id 聚合同一产品的数据；
- 选择当前有效状态/阶段/主目标；
- 汇总今日 Action 与未结束 Task；
- 提供最近 StageSummary；
- 暴露重点 Event 摘要；
- 标明数据更新时间、新鲜度、缺失/降级状态。

## 4. 不负责
- 不重新做经营决策；
- 不调用 Agent 生成新的 FinalDecision；
- 不改变 Task/Event/Goal 状态；
- 不修改源对象；
- 不直接执行任何经营动作。

## 5. UI关系
首页产品摘要和点击后的完整产品状态卡都应读取该聚合结果或其子视图，而不是 UI 自己跨模块拼接。

## 6. 运行边界
当前只定义静态聚合契约和规则；真实查询、缓存、数据库、流处理属于后续运行实现。