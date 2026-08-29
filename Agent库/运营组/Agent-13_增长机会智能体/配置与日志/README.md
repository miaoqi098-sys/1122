# 配置与日志

## 配置项
- candidate/qualified机会门槛；
- impact/confidence/feasibility/urgency/effort评分规则；
- 机会指纹与去重策略；
- 关键约束必须检查的Agent集合；
- 实验最小观察窗口；
- 最大资源暴露；
- 机会窗口过期规则；
- 历史机会复用条件；
- 高影响机会升级条件；
- 数据新鲜度要求。

## 配置版本
机会评分、去重和资格规则必须版本化，记录 `config_version`、`effective_from`、`changed_fields`、`reason`。评分规则变化不得静默改写历史机会排序。

## 审计日志
至少记录：
- opportunity_id / event_id / response_id / validation_id；
- fingerprint；
- source_agent/event refs；
- score_dimensions；
- constraints；
- risk_eligibility；
- dependencies/relations；
- status变化；
- validation结果；
- strategy_chain/context；
- confidence；
- 配置版本与时间。

## 防循环
机会在没有新证据、约束变化或实验结果时不得反复candidate→qualified→candidate。关闭/拒绝机会重新打开时必须记录新的触发证据。
