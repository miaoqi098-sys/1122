# 历史风险与观察窗口

## 目的
风险判断需要保留历史违规/通知、整改、恢复、复发和政策版本上下文，避免把已解决问题永久视为当前风险，也避免忽略反复复发模式。

## 历史对象
- policy_notification；
- account_health_issue；
- listing_restriction；
- compliance_review；
- ip_notice；
- dangerous_goods_review；
- remediation_case；
- appeal_case；
- resolution；
- recurrence。

## 标准历史字段
- history_id；
- risk_domain；
- scope；
- marketplace；
- opened_at / resolved_at；
- rule_version_ref；
- root_cause_ref；
- corrective_actions；
- preventive_actions；
- evidence_refs；
- outcome；
- recurrence_flag；
- superseded_by。

## 观察窗口
- 未解决critical/high风险持续监控；
- 整改完成后设置验证窗口；
- 评价/安全类问题考虑延迟反馈；
- 资质/证书按有效期提前预警；
- 政策规则变更时重新评估受影响对象。

## 复发判断
相似风险再次发生时，必须比较：scope、根因、规则版本、整改措施和供应商/产品版本。只有条件可比时才标记recurrence。

## 历史复用边界
过去申诉成功不等于当前同类案件一定成功；历史材料只能作为案例，必须重新验证当前事实和规则。
