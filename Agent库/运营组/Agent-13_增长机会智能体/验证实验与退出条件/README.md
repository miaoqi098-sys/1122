# 验证实验与退出条件

## 目标
每个qualified机会都必须能通过小范围、可观测、可停止的验证路径降低不确定性，避免机会一进入队列就直接大规模执行。

## 标准验证字段
- validation_id；
- opportunity_id；
- hypothesis；
- scope；
- proposed_test；
- primary_metric；
- guardrail_metrics；
- baseline_ref；
- minimum_observation_window；
- success_condition；
- stop_condition；
- invalidation_condition；
- max_resource_exposure；
- required_controls；
- owner_agents；
- result_status。

## 验证类型
- 小预算广告测试；
- 内容A/B或前后验证；
- 小范围价格/促销实验；
- 库存承接验证；
- 关键词/流量入口验证；
- 观察型自然实验；
- 数据补充/专业Agent复核。

真实测试动作必须经过Agent-1决策与执行层，本模块只设计实验框架。

## 结果状态
`planned / approved / running / success / failed / mixed / inconclusive / invalidated / stopped`

## 停止条件
包括：
- 触发Agent-12风险门；
- 超出Agent-6财务损失上限；
- Agent-7库存进入危险区；
- 核心指标持续劣化；
- 外部趋势/价格/页面条件变化使实验失去可比性；
- 达到最大资源暴露仍无有效信号。

## 成功不等于自动扩量
验证成功后机会状态可升级 `validated`，但是否scale仍需Agent-1基于目标系统、资源、S10稳定性与其他机会组合决定。

## 失败学习
失败必须记录：假设为何不成立、哪些条件失效、可复用结论是什么，交S09/历史机会保存，避免重复测试同一失败假设。
