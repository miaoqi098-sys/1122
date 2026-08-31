# Agent-5｜配置与日志治理

## 1. 配置项
- 流量窗口与基线选择；
- 来源映射规则；
- Query/关键词分组；
- concentration算法/阈值；
- severity/confidence规则；
- freshness要求；
- visibility index算法版本（如启用）；
- minimum_evidence要求。

## 2. 配置原则
阈值和算法不得散落在规则正文；支持account/store/marketplace/product/query_group等scope，记录config_version、effective_at、change_reason和supersedes。

## 3. 日志
至少包括analysis_log、event_log、request_response_log、cause_tree_log、config_change_log、decision_reference_log。

## 4. 审计链
任何流量诊断应能追溯：数据源与窗口 → 来源/Query指标 → 配置版本 → 原因树 → 事件/响应 → Agent-1决策引用。

## 5. 运行边界
真实配置存储、日志索引与持久化由运行层/记忆数据层实现；Agent-5不伪造持久化或真实执行状态。