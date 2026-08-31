# 历史机会与学习

## 目的
保存“过去提出过什么机会、为什么验证、结果如何、哪些条件决定成功/失败”，避免同一假设反复测试，也避免把旧成功案例机械套用到新环境。

## 历史对象
- opportunity_snapshot；
- validation_record；
- experiment_result；
- scale_result；
- rejected_reason；
- invalidation_reason；
- learning_ref。

## 标准字段
- opportunity_id；
- fingerprint；
- scope；
- hypothesis；
- source_evidence_refs；
- constraints_at_time；
- strategy_context；
- validation_plan；
- result；
- metric_change；
- confounders；
- conclusion；
- reusable_conditions；
- non_reusable_conditions；
- completed_at；
- learning_id。

## 复用规则
历史机会只有在scope、市场环境、价格、库存、内容、策略和风险条件足够可比时才可提高当前confidence。不可只因“过去成功”直接跳过当前验证。

## 防重复
新机会生成时先查：
- 相同fingerprint是否正在测试；
- 相似假设是否曾失败；
- 失败原因是否仍存在；
- 旧机会是否因时间窗口结束而关闭。

无新条件变化时，不重复创建/测试同一失败机会。

## 学习写回
机会验证结束后形成LearningRecord/S09写入计划，记录机制、适用条件、反例和置信度。真实持久化由R10/R06实现，Agent-13不伪造已写入状态。
