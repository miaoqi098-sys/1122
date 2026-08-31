# Agent-4｜配置与日志治理

## 1. 配置原则
广告诊断阈值、窗口和策略参数不得散落在规则正文中。框架层只定义配置项、适用范围、版本与覆盖顺序，不固化所有业务百分比。

## 2. 核心配置类别
- metric_windows：current/baseline/observation window；
- attribution_profile：广告类型与归因口径；
- minimum_evidence：最小点击/花费/订单/时间门槛；
- severity_rules：severity映射；
- confidence_rules：证据充分度；
- bid_change_bands：small/medium/large的配置化边界；
- budget_change_bands；
- search_term_governance：迁移/否定的最低证据要求；
- structure_governance：拆分/合并/隔离规则参数；
- freshness_requirements：不同数据类型最大可接受陈旧度。

## 3. 配置作用域
支持account / store / marketplace / product / ad_type / campaign等作用域。覆盖顺序应由通用到具体，具体配置覆盖上层默认；任何覆盖必须可追溯到config_version和effective_at。

## 4. 配置版本
最小字段：config_id、config_version、scope、effective_at、expires_at、author/source、change_reason、supersedes、parameters。历史版本不得静默覆盖。

## 5. 日志类别
- analysis_log：分析输入、窗口、结果、证据；
- event_log：智能事件生成/更新/关闭；
- recommendation_log：候选建议及置信度；
- request_response_log：请求、响应、缺失信息；
- config_change_log：配置变更；
- execution_reference_log：只保存FinalDecision/Task/ExecutionResult引用，不伪造执行。

## 6. 日志最小字段
log_id、log_type、timestamp、agent_id、scope、entity_refs、event_id/request_id/decision_id/task_id（按需）、strategy_chain_id、input_refs、output_refs、config_version、data_window、source_refs、result_summary。

## 7. 审计要求
任何“为什么产生这个建议”都应能追溯到：当时数据窗口 → 指标口径 → 配置版本 → 诊断 → 事件/响应 → Agent-1决策引用。日志不得包含无法验证的“已执行成功”状态。

## 8. 运行边界
真实配置存储、日志持久化、查询索引属于系统运行层/记忆与数据层；Agent-4只定义需要保存和引用的结构。