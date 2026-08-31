# 配置与日志

## 配置项
- 转化异常阈值；
- 最小样本量/观察窗口；
- 内容完整性检查清单版本；
- 移动端重点检查项；
- 实验最小观察期与失效条件；
- 因果等级规则；
- 内容对象版本策略；
- 数据新鲜度要求；
- 高风险claim转Agent-12的触发规则。

## 配置版本
会改变诊断或实验结论的规则必须版本化，记录 `config_version`、`effective_from`、`changed_fields`、`reason`。

## 审计日志
至少记录：
- analysis_id / event_id / response_id / experiment_id；
- scope；
- content_version_refs；
- conversion_window；
- baseline_ref；
- confounders；
- diagnosed_issues；
- causal_level；
- confidence；
- 配置版本；
- 生成与复核时间。

## 原则
不允许覆盖旧内容版本后丢失历史；内容发布、实验结果和转化诊断必须可追溯到当时页面与数据条件。
