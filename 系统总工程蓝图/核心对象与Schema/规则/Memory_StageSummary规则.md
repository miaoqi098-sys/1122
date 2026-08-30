# Memory + StageSummary 规则 V1

## 1. 边界
Memory 是长期可检索的产品/经营历史索引与经验记录；StageSummary 是某一明确产品经营阶段、时间窗口的压缩总结。

Memory 不替代原始 Metric/Event/Decision/Task/Action/Validation；StageSummary 也不得覆盖或删除底层历史。

## 2. 事实、推断、经验分离
- fact_history：引用可验证事实。
- decision/task/action/history：引用真实对象历史。
- validation_learning / strategy_experience：允许经验与学习结论，但必须保留证据/来源并可带 confidence/有效期。
- 不允许把推断写成事实。

## 3. 追加优先
历史默认追加。若旧 Memory 失效或被修订，使用 `supersedes_memory_id` 建立替代关系，不直接覆盖删除。

## 4. StageSummary
必须绑定 product_id、stage_code、stage_definition_version、period_start/end，并通过 refs 回指 Goal/Metric/Event/Decision/Task/Action/Validation。
阶段总结是索引层；完整历史仍通过底层对象链查询。

## 5. 产品状态卡
“最近阶段总结”优先读取最新有效 StageSummary；“完整经营历史”进入 Memory Timeline / 原始对象链。

## 6. 生成边界
Agent 可以生成摘要草稿，但结构化引用必须来自已存在的业务对象。摘要不得成为一个事件/动作曾发生过的唯一证据。

## 7. 运行依赖
Memory Repository、向量/检索索引、时间线聚合、StageSummary Generator、长期持久化属于后续运行建设。