# Agent-2｜配置与日志

## 1. 配置定位
Agent-2配置只定义商品状态监控的框架参数合同，不硬编码真实抓取频率、账号密钥或平台接口实现。

允许配置类型：
- 监控scope清单；
- 状态域启停；
- 事件severity映射的框架默认；
- 状态复核/持续确认策略引用；
- 新鲜度/TTL引用；
- 数据源优先级；
- 事件去重窗口引用；
- 专业结果valid_until/review_at策略；
- schema refs。

## 2. 禁止配置
- API密钥/token；
- 固定业务决策动作；
- “发现Buy Box丢失就自动降价”一类策略；
- 真实Scheduler cron实现；
- 把P0-P3映射成Agent-1固定business_priority；
- 跨过Agent-1直接执行价格/Listing/促销变更。

## 3. 推荐配置合同
```text
agent_id: Agent-2
config_version
monitoring_scopes
status_domains
event_schema_ref
specialist_result_schema_ref
freshness_policy_ref
dedupe_policy_ref
data_source_policy_ref
runtime_placeholders
```

## 4. 日志要求
Agent-2至少需要记录：
- 监控尝试；
- 状态快照ID；
- 来源/证据；
- diff结果；
- 去重/合并结果；
- Event上报；
- Agent-1请求/响应；
- 数据缺失/工具失败；
- 转交其他Agent；
- 恢复事件。

## 5. 日志边界
运行日志可以记录run_id/trace_id，但商品状态业务对象仍使用snapshot_id/event_id/request_id等业务引用。

不得把“采集任务成功”写成“商品状态正常”；采集成功只是工具/运行事实。

## 6. 真实实现
配置加载、定时器、日志存储、trace、密钥和数据接口由未来R02/R04/R06/R07/R12等共享能力实现。