# 配置与日志

## 配置项
- marketplace政策源与可信级别；
- 规则版本/生效时间；
- 风险severity分级；
- eligibility映射；
- 证据新鲜度/有效期；
- 资质到期预警窗口；
- 高风险自动升级条件；
- 人工审批要求；
- 整改验证窗口；
- 数据缺失时的降级规则。

## 配置版本
政策源、风险等级、资格门、证据要求等任何影响风险结论的配置必须版本化，记录 `config_version`、`effective_from`、`changed_fields`、`reason`、`source_ref`。

## 审计日志
至少记录：
- risk_id / event_id / response_id；
- scope/marketplace；
- factual_evidence_refs；
- rule_refs及版本；
- severity；
- eligibility_status；
- required_controls；
- missing_evidence；
- approval_state；
- remediation/appeal refs；
- confidence；
- 生成、复核、解除时间。

## 审计原则
风险状态变化必须可解释：从何规则、何证据、由谁/何系统确认。禁止静默把 `requires_more_evidence` 改成 `eligible`，也禁止整改未真实执行就把状态改成resolved。
